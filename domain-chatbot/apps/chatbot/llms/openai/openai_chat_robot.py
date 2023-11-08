import logging
import os
from ...utils.str_utils import remove_spaces_and_tabs
from langchain.chat_models import ChatOpenAI
from langchain.schema import (
    HumanMessage,
)
import openai

logger = logging.getLogger(__name__)


class OpenAIGeneration:
    llm: ChatOpenAI

    def __init__(self, model_name: str = "gpt-3.5-turbo") -> None:
        from dotenv import load_dotenv

        load_dotenv()
        OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
        OPENAI_BASE_URL = os.environ["OPENAI_BASE_URL"]
        if OPENAI_BASE_URL != None and OPENAI_BASE_URL != "":
            if model_name == "gpt-3.5-turbo":
                self.llm = ChatOpenAI(
                    temperature=0.7,
                    model_name="gpt-3.5-turbo",
                    openai_api_key=OPENAI_API_KEY,
                    openai_api_base=OPENAI_BASE_URL,
                )
            else:
                self.llm = ChatOpenAI(
                    temperature=0.7,
                    model_name="gpt-4",
                    openai_api_key=os.environ["OPENAI_API_KEY_4"],
                    openai_api_base=os.environ["OPENAI_BASE_URL_4"],
                )
        else:
            self.llm = ChatOpenAI(
                temperature=0.7,
                model_name="gpt-3.5-turbo",
                openai_api_key=OPENAI_API_KEY,
            )

    # def chat(
    #     self,
    #     prompt: str,
    #     role_name: str,
    #     you_name: str,
    #     query: str,
    #     short_history: list[dict[str, str]],
    #     long_history: str,
    # ) -> str:
    #     prompt = prompt + query
    #     logger.debug(f"1.GPT提问：{HumanMessage(content=prompt)}")
    #     llm_result = self.llm.generate(messages=[[HumanMessage(content=prompt)]])
    #     llm_result_text = llm_result.generations[0][0].text
    #     logger.debug(f"1.GPT回复：{llm_result_text}")
    #     return llm_result_text

    def chat(
        self,
        prompt: str,
        role_name: str,
        you_name: str,
        query: str,
        short_history: list[dict[str, str]],
        long_history: str,
    ) -> str:
        messages = []
        messages.append({"role": "user", "content": prompt + query})
        logger.debug(f"1.GPT提问：{messages}")
        response = openai.ChatCompletion.create(
            # model="gpt-3.5-turbo",
            model="gpt-4",
            messages=messages,
        )
        answer = response["choices"][0]["message"]["content"]
        logger.debug(f"1.GPT回复：{answer}")
        return answer

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
        # logger.debug(f"2.GPT提问：{query}")
        messages = []
        messages.append({"role": role, "content": prompt})
        reversed_history = list(reversed(history))
        for item in reversed_history:
            logger.debug(f"2.历史消息：{item}")
            message = {"role": "user", "content": item["human"]}
            messages.append(message)
            message = {"role": "assistant", "content": item["ai"]}
            messages.append(message)
        messages.append({"role": "user", "content": query})
        logger.debug(f"2.GPT提问：{messages}")
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=messages,
        )

        answer = response["choices"][0]["message"]["content"]
        logger.debug(f"2.GPT回复：{answer}")

        if realtime_callback:
            realtime_callback(role_name, you_name, answer, query)  # 调用实时消息推送的回调函数

        if conversation_end_callback:
            conversation_end_callback(
                role_name, answer, you_name, query
            )  # 调用对话结束消息的回调函数

    # async def chatStream(
    #     self,
    #     prompt: str,
    #     role_name: str,
    #     you_name: str,
    #     query: str,
    #     history: list[dict[str, str]],
    #     realtime_callback=None,
    #     conversation_end_callback=None,
    # ):
    #     logger.debug(f"openai提示词（流式）：{prompt}")
    #     messages = []
    #     for item in history:
    #         message = {"role": "user", "content": item["human"]}
    #         messages.append(message)
    #         message = {"role": "assistant", "content": item["ai"]}
    #         messages.append(message)
    #     messages.append({"role": "system", "content": prompt})
    #     messages.append({"role": "user", "content": you_name + "说" + query})
    #     response = openai.ChatCompletion.create(
    #         model="gpt-3.5-turbo",
    #         messages=messages,
    #         temperature=0,
    #         stream=True,  # again, we set stream=True
    #     )

    #     # create variables to collect the stream of chunks
    #     answer = ""
    #     # logger.info(f"{''.join(map(str, response))}")
    #     logger.info(f"=========1===========")
    #     logger.info(f"{type(response)}")

    #     try:
    #         for part in response:
    #             # logger.info(f"==3=={str(part)}")
    #             finish_reason = part["choices"][0]["finish_reason"]
    #             if "content" in part["choices"][0]["delta"]:
    #                 content = part["choices"][0]["delta"]["content"]
    #                 # logger.info(f"{content}")
    #                 # 过滤空格和制表符
    #                 content = remove_spaces_and_tabs(content)
    #                 if content == "":
    #                     continue
    #                 answer += content
    #                 if realtime_callback:
    #                     realtime_callback(
    #                         role_name, you_name, content, False
    #                     )  # 调用实时消息推送的回调函数
    #             elif finish_reason:
    #                 # logger.info(
    #                 #     f"==>openai（流式）响应：role_name: {role_name}, answer: {answer}, you_name: {you_name}, query: {query}"
    #                 # )
    #                 if realtime_callback:
    #                     realtime_callback(
    #                         role_name, you_name, content, True
    #                     )  # 调用实时消息推送的回调函数
    #                 if conversation_end_callback:
    #                     conversation_end_callback(
    #                         role_name, answer, you_name, query
    #                     )  # 调用对话结束消息的回调函数
    #                 break  # 停止循环，对话已经结束
    #             else:
    #                 logger.warn(f"==4=={str(part)}")
    #     except Exception as e:
    #         logger.error(f"==5==响应错误: {e}")
