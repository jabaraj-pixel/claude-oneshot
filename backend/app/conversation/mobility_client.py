"""Mobility service client for the dialogue manager (Worker 1).

Calls Worker 2's mobility engine strictly through the shared contract in
docs/API_CONTRACTS.md:
  * POST /api/mobility/routes/search  (JourneyRequest -> JourneyResult)
  * GET  /api/mobility/stops/search   (query, limit -> stop candidate list)

Two transports are provided:
  * HttpMobilityClient   — HTTP against a running mobility API (exact contract).
  * EngineMobilityClient — in-process adapter around a BaseMobilityEngine
                           implementation (public interface only).

When no engine/API is configured, UnconfiguredMobilityClient keeps the whole
dialogue usable and reports a clear, honest "service unavailable" outcome.
The voice module NEVER computes routes itself.
"""
from abc import ABC, abstractmethod
from typing import List, Optional

import httpx
from pydantic import ValidationError

from backend.app.core.errors import IntegrationNotConfiguredError
from backend.app.core.logging import logger
from backend.app.mobility.service import BaseMobilityEngine
from backend.app.schemas.shared import JourneyRequest, JourneyResult


class MobilityClientError(Exception):
    """Base class for mobility lookup failures handled by the dialogue."""


class MobilityUnavailableError(MobilityClientError):
    """Service not configured, unreachable, or returned a server error."""


class MobilityTimeoutError(MobilityClientError):
    """The mobility service did not respond within the allowed time."""


class MobilityBadResponseError(MobilityClientError):
    """The service responded, but the payload violated the shared contract."""


class MobilityBadRequestError(MobilityClientError):
    """400: origin or destination could not be resolved by the engine."""

    def __init__(self, message: str, details=None):
        super().__init__(message)
        self.details = details


class StopsLookupUnsupported(MobilityClientError):
    """Stops lookup endpoint/engine not available — resolution is skipped."""


class BaseMobilityClient(ABC):
    """Dialogue-side interface for route and stop lookups."""

    @abstractmethod
    async def search_routes(self, request: JourneyRequest) -> JourneyResult:
        """Return a verified JourneyResult or raise a MobilityClientError."""

    @abstractmethod
    async def search_stops(self, query: str, limit: int = 5) -> List[dict]:
        """Return stop candidates for disambiguation, or raise StopsLookupUnsupported."""


class UnconfiguredMobilityClient(BaseMobilityClient):
    """Default when Worker 2's engine/API is not connected yet."""

    async def search_routes(self, request: JourneyRequest) -> JourneyResult:
        raise MobilityUnavailableError(
            "Mobility engine is not configured (INTEGRATION_NOT_CONFIGURED). "
            "Connect Worker 2's engine or set MOBILITY_API_BASE_URL."
        )

    async def search_stops(self, query: str, limit: int = 5) -> List[dict]:
        raise StopsLookupUnsupported("Mobility engine is not configured.")


class HttpMobilityClient(BaseMobilityClient):
    """HTTP client for the mobility API exactly as per docs/API_CONTRACTS.md."""

    def __init__(self, base_url: str, timeout_seconds: float = 8.0, transport: Optional[httpx.AsyncBaseTransport] = None):
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout_seconds
        self._transport = transport  # test seam (httpx.MockTransport)

    async def search_routes(self, request: JourneyRequest) -> JourneyResult:
        try:
            async with httpx.AsyncClient(timeout=self._timeout, transport=self._transport) as client:
                response = await client.post(
                    f"{self._base_url}/api/mobility/routes/search",
                    json=request.model_dump(mode="json"),
                )
        except httpx.TimeoutException as exc:
            raise MobilityTimeoutError("Mobility API request timed out") from exc
        except httpx.HTTPError as exc:
            raise MobilityUnavailableError(f"Mobility API unreachable: {exc}") from exc

        if response.status_code == 400:
            details = None
            try:
                details = response.json().get("error", {}).get("details")
            except ValueError:
                pass
            raise MobilityBadRequestError("Origin or destination unresolved", details)
        if response.status_code != 200:
            raise MobilityUnavailableError(
                f"Mobility API returned HTTP {response.status_code}"
            )
        try:
            return JourneyResult.model_validate(response.json())
        except (ValueError, ValidationError) as exc:
            logger.warning("Mobility API returned a malformed JourneyResult: %s", exc)
            raise MobilityBadResponseError("Malformed JourneyResult payload") from exc

    async def search_stops(self, query: str, limit: int = 5) -> List[dict]:
        try:
            async with httpx.AsyncClient(timeout=self._timeout, transport=self._transport) as client:
                response = await client.get(
                    f"{self._base_url}/api/mobility/stops/search",
                    params={"query": query, "limit": limit},
                )
        except httpx.TimeoutException as exc:
            raise MobilityTimeoutError("Mobility stops lookup timed out") from exc
        except httpx.HTTPError as exc:
            raise MobilityUnavailableError(f"Mobility API unreachable: {exc}") from exc

        if response.status_code in (404, 501):
            raise StopsLookupUnsupported(f"Stops lookup HTTP {response.status_code}")
        if response.status_code != 200:
            raise MobilityUnavailableError(
                f"Stops lookup returned HTTP {response.status_code}"
            )
        try:
            data = response.json()
            if not isinstance(data, list):
                raise ValueError("Expected a JSON list of stops")
            return data
        except ValueError as exc:
            raise MobilityBadResponseError("Malformed stops lookup payload") from exc


class EngineMobilityClient(BaseMobilityClient):
    """In-process adapter around a BaseMobilityEngine (Worker 2's interface)."""

    def __init__(self, engine: BaseMobilityEngine, timeout_seconds: float = 8.0):
        self._engine = engine
        self._timeout = timeout_seconds

    async def search_routes(self, request: JourneyRequest) -> JourneyResult:
        import asyncio

        try:
            result = await asyncio.wait_for(
                self._engine.search_routes(request), timeout=self._timeout
            )
        except asyncio.TimeoutError as exc:
            raise MobilityTimeoutError("Mobility engine timed out") from exc
        except IntegrationNotConfiguredError as exc:
            raise MobilityUnavailableError(str(exc)) from exc
        except NotImplementedError as exc:
            raise MobilityUnavailableError("Mobility engine not implemented yet") from exc
        if not isinstance(result, JourneyResult):
            raise MobilityBadResponseError(
                "Mobility engine returned a payload outside the shared contract"
            )
        return result

    async def search_stops(self, query: str, limit: int = 5) -> List[dict]:
        import asyncio

        try:
            result = await asyncio.wait_for(
                self._engine.search_stops(query, limit=limit), timeout=self._timeout
            )
        except asyncio.TimeoutError as exc:
            raise MobilityTimeoutError("Mobility engine stops lookup timed out") from exc
        except (IntegrationNotConfiguredError, NotImplementedError) as exc:
            raise StopsLookupUnsupported(str(exc)) from exc
        if not isinstance(result, list):
            raise MobilityBadResponseError("Engine stops lookup returned a non-list")
        return result


def build_default_mobility_client() -> BaseMobilityClient:
    """Factory: HTTP client when MOBILITY_API_BASE_URL is set, else unconfigured.

    Note for the Integration Lead: MOBILITY_API_BASE_URL is a proposed new
    setting for backend/app/config.py (documented in the module README). Until
    it is adopted there, it is read directly from the environment. It is a
    non-secret endpoint URL, not a credential.
    """
    import os

    base_url = os.environ.get("MOBILITY_API_BASE_URL", "").strip()
    if base_url:
        logger.info("Dialogue mobility client: HTTP %s", base_url)
        return HttpMobilityClient(base_url)
    logger.info("Dialogue mobility client: UNCONFIGURED (text dialogue still works)")
    return UnconfiguredMobilityClient()
