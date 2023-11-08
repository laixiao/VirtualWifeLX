from __future__ import annotations
from abc import ABC, abstractmethod
import logging
import threading
import asyncio
from .openai.openai_chat_robot import OpenAIGeneration
from .text_generation.text_generation_chat_robot import TextGeneration
logger = logging.getLogger(__name__)

class LlmModelStrategy(ABC):
    @abstractmethod
    def chat(
        self,
        prompt: str,
        role_name: str,
        you_name: str,
        query: str,
        short_history: list[dict[str, str]],
        long_history: str,
    ) -> str:
        pass

    @abstractmethod
    async def chatStream(
        self,
        role: str,
        prompt: str,
        role_name: str,
        you_name: str,
        query: str,
        history: list[dict[str, str]],
        realtime_callback=None,
        conversation_end_callback=None,
    ):
        pass


# 定义策略类实现
class OpenAILlmModelStrategy(LlmModelStrategy):

    def __init__(self) -> None:
        super().__init__()
        self.openai3_5 = OpenAIGeneration()
        self.openai4 = OpenAIGeneration("gpt-4")

    def chat(
        self,
        prompt: str,
        role_name: str,
        you_name: str,
        query: str,
        short_history: list[dict[str, str]],
        long_history: str,
    ) -> str:
        strategy = self.get_strategy()
        return strategy.chat(
            prompt=prompt,
            role_name=role_name,
            you_name=you_name,
            query=query,
            short_history=short_history,
            long_history=long_history,
        )

    async def chatStream(
        self,
        prompt: str,
        role_name: str,
        you_name: str,
        query: str,
        history: list[dict[str, str]],
        realtime_callback=None,
        conversation_end_callback=None,
    ):
        strategy = self.get_strategy("gpt-4")
        return await strategy.chatStream(
            prompt=prompt,
            role_name=role_name,
            you_name=you_name,
            query=query,
            history=history,
            realtime_callback=realtime_callback,
            conversation_end_callback=conversation_end_callback,
        )

    def get_strategy(self, model_name: str = "gpt-3.5-turbo") -> LlmModelStrategy:
        logger.debug(f"OpenAILlmModelStrategy模型：{model_name}")
        if model_name == "gpt-3.5-turbo":
            return self.openai3_5
        else:
            return self.openai4
            

class TextGenerationLlmModelStrategy(LlmModelStrategy):
    generation: TextGeneration

    def __init__(self) -> None:
        super().__init__()
        self.generation = TextGeneration()

    def chat(
        self,
        prompt: str,
        role_name: str,
        you_name: str,
        query: str,
        short_history: list[dict[str, str]],
        long_history: str,
    ) -> str:
        return self.generation.chat(
            prompt=prompt,
            role_name=role_name,
            you_name=you_name,
            query=query,
            short_history=short_history,
            long_history=long_history,
        )

    async def chatStream(
        self,
        prompt: str,
        role_name: str,
        you_name: str,
        query: str,
        history: list[dict[str, str]],
        realtime_callback=None,
        conversation_end_callback=None,
    ):
        return await self.generation.chatStream(
            prompt=prompt,
            role_name=role_name,
            you_name=you_name,
            query=query,
            history=history,
            realtime_callback=realtime_callback,
            conversation_end_callback=conversation_end_callback,
        )


class LlmModelDriver:
    def __init__(self):
        self.openai3_5 = OpenAIGeneration()
        self.openai4 = OpenAIGeneration("gpt-4")
        self.textGeneration = TextGenerationLlmModelStrategy()
        self.chat_stream_lock = threading.Lock()

    def chat(
        self,
        prompt: str,
        type: str,
        role_name: str,
        you_name: str,
        query: str,
        short_history: list[dict[str, str]],
        long_history: str,
    ) -> str:
        strategy = self.get_strategy(type)
        result = strategy.chat(
            prompt=prompt,
            role_name=role_name,
            you_name=you_name,
            query=query,
            short_history=short_history,
            long_history=long_history,
        )
        return result

    def chatStream(
        self,
        role: str,
        prompt: str,
        type: str,
        role_name: str,
        you_name: str,
        query: str,
        history: list[dict[str, str]],
        realtime_callback=None,
        conversation_end_callback=None,
    ):
        strategy = self.get_strategy(type, "gpt-4")
        asyncio.run(
            strategy.chatStream(
                role=role,
                prompt=prompt,
                role_name=role_name,
                you_name=you_name,
                query=query,
                history=history,
                realtime_callback=realtime_callback,
                conversation_end_callback=conversation_end_callback,
            )
        )

    def get_strategy(self, type: str, model_name: str = "gpt-3.5-turbo") -> LlmModelStrategy:
        if type == "openai":
            logger.debug(f"LlmModelDriver模型：{model_name}")
            if model_name == "gpt-3.5-turbo":
                return self.openai3_5
            else:
                return self.openai4
        
        elif type == "text_generation":
            return self.textGeneration
        else:
            raise ValueError("Unknown type")
