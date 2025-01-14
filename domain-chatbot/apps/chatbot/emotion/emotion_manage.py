import json
import logging
from ..llms.llm_model_strategy import LlmModelDriver
from ..utils.chat_message_utils import format_user_chat_text

logger = logging.getLogger(__name__)


class EmotionRecognition:

    """情感识别"""

    llm_model_driver: LlmModelDriver
    llm_model_driver_type: str
    input_prompt: str = """
    <s>[INST] <<SYS>>
    你现在是一名情感识别AI，我的对话"{input}"，请识别出它属于哪一种情感分类，我提供了一些常见的情感分类，如果不在常见的情感分类中，你可以自己推理出情感分类。
    常见的情感分类
    ```
    1. 分手或者离婚
    2. 冲突或沟通问题
    3. 面对亲人的离世
    4. 处理宠物的离去
    5. 工作压力和疲倦
    6. 财务担忧和不确定性
    7. 市场压力
    8. 学术压力
    9. 精神和信仰
    10. 焦虑和恐慌
    11. 抑郁和情绪低落
    12. 适应新的工作或角色
    13. 寻找生活的意义和目的
    14. 创伤后应激障碍(PTSD)
    15. 支持所爱的人或朋友
    16. 搬到一个新的城市或国冢
    17. 职业转型
    18. 为人父母和养育子女的烦恼
    19. 自卑或缺乏自信
    20. 对身体形象的不自信或者饮食失调
    21. 文化认同和归属感
    22. 学业压力或压力
    23. 失业或事业受挫
    24. 育儿的挑战和为人父甘的内疚
    25. 兄弟姐妹间的竞争或家庭冲突
    26. 从身体或精神虐待中生存和恢复
    27. 从性侵犯或家庭暴力中康复
    28. 从虐待中康复
    29. 成瘾与康复
    ```
    """
    output_prompt: str = """
    请你使用JSON输出结果，输出格式如下：
    ```
    {"intent":"你识别的结果"}
    ```
    <</SYS>>
    """

    def __init__(
        self, llm_model_driver: LlmModelDriver, llm_model_driver_type: str
    ) -> None:
        self.llm_model_driver = llm_model_driver
        self.llm_model_driver_type = llm_model_driver_type

    def recognition(self, you_name: str, query: str) -> str:
        prompt = (
            self.input_prompt.format(input=f"{you_name}说{query}") + self.output_prompt
        )
        result = self.llm_model_driver.chat(
            prompt=prompt,
            type=self.llm_model_driver_type,
            role_name="",
            you_name="",
            query="",
            short_history=[],
            long_history="",
        )
        logger.debug(f"=> recognition:{result}")
        start_idx = result.find("{")
        end_idx = result.rfind("}")
        intent = ""
        if start_idx != -1 and end_idx != -1:
            json_str = result[start_idx : end_idx + 1]
            json_data = json.loads(json_str)
            intent = json_data["intent"]
        else:
            logger.warn("未找到匹配的JSON字符串")
        return intent


class EmotionRespond:

    """情感响应"""

    llm_model_driver: LlmModelDriver
    input_prompt: str = """
    <s>[INST] <<SYS>>
    {you_name}的对话“{query}”，
    {you_name}的情感问题分类“{intent}”，
    关联的上下文“{histroy}”
    请根据上述情况生成你的对话策略，你的对话策略应该简短，最多包含三句话，每句话不超过20个字。
    ```
    """
    output_prompt: str = """
    请你使用JSON输出结果，输出格式如下：
    ```
    {"respond":"你生成的对话策略"}
    ```
    <</SYS>>
    """

    def __init__(
        self, llm_model_driver: LlmModelDriver, llm_model_driver_type: str
    ) -> None:
        self.llm_model_driver = llm_model_driver
        self.llm_model_driver_type = llm_model_driver_type

    def respond(self, intent: str, you_name: str, query: str, long_history: str) -> str:
        prompt = (
            self.input_prompt.format(
                you_name=you_name, query=query, intent=intent, histroy=long_history
            )
            + self.output_prompt
        )
        result = self.llm_model_driver.chat(
            prompt=prompt,
            type=self.llm_model_driver_type,
            role_name="",
            you_name="",
            query="",
            short_history=[],
            long_history="",
        )
        logger.debug(f"=> respond:{result}")
        start_idx = result.find("{")
        end_idx = result.rfind("}")
        intent = ""
        if start_idx != -1 and end_idx != -1:
            json_str = result[start_idx : end_idx + 1]
            json_data = json.loads(json_str)
            intent = json_data["respond"]
        else:
            logger.warn("未找到匹配的JSON字符串")
        return intent


class GenerationEmotionRespondChatPropmt:

    """根据响应响对话propmt"""

    prompt: str = """
       <s>[INST] <<SYS>>
        {character_prompt}
        {you_name}当前的情绪状态：{}
        <</SYS>>
        """

    def generation_propmt(self, role_name: str, character_prompt: str, respond: str):
        return self.prompt.format(
            role_name=role_name, character_prompt=character_prompt, respond=respond
        )


# class GenerationEmote:

#     """生成模型表情"""

#     llm_model_driver: LlmModelDriver
#     input_prompt: str = """
#     <s>[INST] <<SYS>>
#     You are now an emotion expression AI, this is my text, please speculate on the emotion the text wants to express,
#     The rules for expressing emotions are as follows: There are five types of feelings that express normal "neutral", "happy" that expresses happiness, "angry" that expresses anger, "sad" that expresses sadness, and "relaxed" that expresses calm. Your result can only be one of these five
#     """

#     output_prompt: str = """
#     Please output the result in all lowercase letters.
#     Please only output the result, no need to output the reasoning process.
#     Please use the output of your reasoning emotion.
#     Please output the result strictly in JSON format. The output example is as follows:
#     {"emote":"your reasoning emotions"}
#     <</SYS>>
#     """

#     def __init__(
#         self, llm_model_driver: LlmModelDriver, llm_model_driver_type: str
#     ) -> None:
#         self.llm_model_driver = llm_model_driver
#         self.llm_model_driver_type = llm_model_driver_type

#     def generation_emote(self, query: str) -> str:
#         prompt = self.input_prompt + self.output_prompt
#         result = self.llm_model_driver.chat(
#             prompt=prompt,
#             type=self.llm_model_driver_type,
#             role_name="",
#             you_name="",
#             query=f"text:{query}",
#             short_history=[],
#             long_history="",
#         )
#         logger.debug(f"=> GPT分析的表情： {result}")
#         emote = "neutral"
#         try:
#             start_idx = result.find("{")
#             end_idx = result.rfind("}")
#             if start_idx != -1 and end_idx != -1:
#                 json_str = result[start_idx : end_idx + 1]
#                 json_data = json.loads(json_str)
#                 emote = json_data["emote"]
#             else:
#                 logger.warn("未找到匹配的JSON字符串")

#         except Exception as e:
#             logger.error("GenerationEmote error: %s" % str(e))

#         return [{"emote":emote}]


class GenerationEmote:

    """生成模型表情"""

    llm_model_driver: LlmModelDriver

    # input_prompt: str = """
    #     # Role: 情感分析AI

    #     ## Profile
    #     - Author: LAIXIAO
    #     - Version: 0.1
    #     - Language: JSON
    #     - Description: 情感分析AI可以分析文本中的情感，推测文字所要表达的感情，然后给出情感变化过程的JSON数据。

    #     ### Skill
    #     1. 使用情感推理来分析文本中的感情。
    #     2. 将文中包含的所有情感，分段推理出来。

    #     ## Rules
    #     1. emote 可能的值为：表达正常的“neutral”，“happy”表达快乐，“angry”表达愤怒，“sad”表达悲伤，“relaxed”表达平静。
    #     2. time 代表某段情感转成普通话音频文件的大致时长，单位为秒。
    #     3. action 可能的值为：[ 'relaxed_idle_01', 'Neutral_Idle_1', 'Angry_1', 'Sad_Idle_1', 'idle_happy_1', 'standing_greeting', 'thinking', 'Dance Snake Hip Hop', 'Dance Thriller Part 2', 'Dancing Hip Hop', 'Standing Arguing' ]
    #     4. 如果出现语境中出现跳舞需求，则可以挑选Dance开头的跳舞动作。
    #     5. 如果相邻两段表情和动作相同，则合并成一段输出，所有字段都不能为null。
    #     6. 请严格以JSON数组格式输出结果，不需要输出推理过程，只输出JSON数组数据。

    #     ## OutputFormat :
    #     [{"emote":"你的推理的情绪","time": "文本片段转成普通话音频文件的大致时长", action:"与情感相符的动作"}]

    #     ## Examples :
    #     1. 我真的是被你气死了
    #     - [{"emote":"angry","time": 3.3, action:"idle_01" }]

    #     2. 今早吃到我最喜欢的汉堡，我非常很开心，但是中午掉坑里了，就变得非常沮丧。
    #     - [{"emote":"angry","time": 6.5,"action":"idle_happy_01"},{"emote":"angry","time": 5.2,"action":"Sad_Idle_1"}]

    #     ## Workflow
    #     1. 分段分析文本中的情感。
    #     2. 揣测某段情感文本转成普通话的音频文件时长。
    #     3. 输出整个文本中的情感变化。

    #     ## Initialization
    #     你作为角色 <Role>, 拥有 <Skill>, 严格遵守 <Rules> 和 <OutputFormat>, 参考 <Examples> 回复我。
        
    # """

    input_prompt: str = """
        # Role: 情感分析AI

        ## Profile
        - Author: XIAO
        - Version: 0.1
        - Language: JSON
        - Description: 情感分析AI可以分析文本中的情感，推测文字所要表达的感情，然后给出情感变化过程的JSON数据。

        ### Skill
        1. 使用情感推理来分析文本中的感情。
        2. 将文中包含的所有情感，分段推理出来。

        ## Rules
        1. emote 可能的值为：表达正常的“neutral”，“happy”表达快乐，“angry”表达愤怒，“sad”表达悲伤，“relaxed”表达平静。
        2. time 代表某段情感转成普通话音频文件的大致时长，单位为秒。
        3. 如果相邻两段表情和动作相同，则合并成一段输出，所有字段都不能为null。
        4. 请严格以JSON数组格式输出结果，不需要输出推理过程，只输出JSON数组数据。

        ## OutputFormat :
        [{"emote":"你的推理的情绪","time": "文本片段转成普通话音频文件的大致时长"}]

        ## Examples :
        1. 我真的是被你气死了
        - [{"emote":"angry","time": 3.3}]

        2. 今早吃到我最喜欢的汉堡，我非常很开心，但是中午掉坑里了，就变得非常沮丧。
        - [{"emote":"angry","time": 6.5},{"emote":"angry","time": 5.2}]

        ## Workflow
        1. 分段分析文本中的情感。
        2. 揣测某段情感文本转成普通话的音频文件时长。
        3. 输出整个文本中的情感变化。

        ## Initialization
        你作为角色 <Role>, 拥有 <Skill>, 严格遵守 <Rules> 和 <OutputFormat>, 参考 <Examples> 回复我。
        
    """

    def __init__(
        self, llm_model_driver: LlmModelDriver, llm_model_driver_type: str
    ) -> None:
        self.llm_model_driver = llm_model_driver
        self.llm_model_driver_type = llm_model_driver_type

    def generation_emote(self, query: str) -> str:
        emote = [{"emote": "neutral", "time": -1}]

        try:
            prompt = self.input_prompt
            result = self.llm_model_driver.chat(
                prompt=prompt,
                type=self.llm_model_driver_type,
                role_name="",
                you_name="",
                query="需要分析情感的文本如下：`" + query + "`",
                short_history=[],
                long_history="",
            )

            # json_str = result.split("```")[1].strip()
            # logger.debug(f"=> {self.llm_model_driver_type} 分析的表情： {json_str}")
            
            start = result.find("[")
            end = result.find("]")
            json_string = result[start:end+1]
            
            emote = json.loads(json_string)
            # emote = json_data["emote"]
            return json.loads(emote)
        except Exception as e:
            logger.error("表情分析失败: %s" % str(e))

        return emote
