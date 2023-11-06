import logging
import time
import traceback
from ..character.character_generation import singleton_character_generation
from ..config import singleton_sys_config
from ..output.realtime_message_queue import realtime_callback, realtime_callback2
from ..chat.chat_history_queue import conversation_end_callback
from ..emotion.emotion_manage import (
    EmotionRecognition,
    EmotionRespond,
    GenerationEmotionRespondChatPropmt,
)
from ..utils.datatime_utils import get_current_time_str

logger = logging.getLogger(__name__)


class ProcessCore:
    generation_emotion_respond_chat_propmt: GenerationEmotionRespondChatPropmt

    def __init__(self) -> None:
        # 加载自定义角色生成模块
        self.singleton_character_generation = singleton_character_generation
        self.generation_emotion_respond_chat_propmt = (
            GenerationEmotionRespondChatPropmt()
        )

    def chat(self, you_name: str, query: str, retry_count=0):
        max_retries = 3  # 设置最大重试次数

        # 生成角色prompt
        character = self.singleton_character_generation.get_character(
            singleton_sys_config.character
        )
        role_name = character.role_name

        try:
            prompt = self.singleton_character_generation.output_prompt(character)

            # 检索关联的短期记忆和长期记忆
            short_history = (
                singleton_sys_config.memory_storage_driver.search_short_memory(
                    query_text=query, you_name=you_name, role_name=role_name
                )
            )
            long_history = (
                singleton_sys_config.memory_storage_driver.search_lang_memory(
                    query_text=query, you_name=you_name, role_name=role_name
                )
            )

            current_time = get_current_time_str()
            prompt = prompt.format(
                you_name=you_name, long_history=long_history, current_time=current_time
            )

            # logger.info(prompt)

            # 调用大语言模型流式生成对话
            singleton_sys_config.llm_model_driver.chatStream(
                prompt=prompt,
                type=singleton_sys_config.conversation_llm_model_driver_type,
                role_name=role_name,
                you_name=you_name,
                query=query,
                history=short_history,
                realtime_callback=realtime_callback2,
                conversation_end_callback=conversation_end_callback,
            )
        except Exception as e:
            #     error_message = "请稍后!"
            #     traceback.print_exc()
            #     logger.error("chat error: %s" % str(e))
            #     realtime_callback(role_name=role_name,
            #                       you_name=you_name, content=error_message, end_bool=True)
            logger.error(f"大语言请求失败: {str(e)}")
            if retry_count < max_retries:
                # 等待一定时间，比如1秒，避免紧密循环
                logger.info(f"重试次数: {retry_count}")
                time.sleep(1)
                self.chat(you_name, query, retry_count + 1)  # 重试，并增加重试计数
            else:
                error_message = "尝试了多次仍然失败，请稍后再试！"
                realtime_callback(
                    role_name=role_name,
                    you_name=you_name,
                    content=error_message,
                    end_bool=True,
                )
