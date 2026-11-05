import logging
import sys
from typing import Any, Dict


def setup_logging(level: str = "INFO") -> logging.Logger:
    """
    Configure structured application-wide logging.
    """
    log_level = getattr(logging, level.upper(), logging.INFO)

    log_format = (
        "%(asctime)s [%(levelname)s] [%(name)s] "
        "%(message)s"
    )

    logging.basicConfig(
        level=log_level,
        format=log_format,
        handlers=[
            logging.StreamHandler(sys.stdout),
        ],
        force=True,
    )

    logger = logging.getLogger("chennai_mobility_ai")
    logger.setLevel(log_level)
    return logger


logger = setup_logging()

