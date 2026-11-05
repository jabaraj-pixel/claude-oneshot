"""Process-wide dialogue runtime (Worker 1).

One ConversationManager shared by the voice API and the telephony layer so a
call can move between text turns and audio streaming without losing state.
Tests construct their own managers instead of using this singleton.
"""
from backend.app.conversation.manager import ConversationManager

conversation_manager = ConversationManager()
