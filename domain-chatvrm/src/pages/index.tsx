import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import VrmViewer from "@/components/vrmViewer";
import { ViewerContext } from "@/features/vrmViewer/viewerContext";
import { EmotionType, Message, Screenplay, textsToScreenplay, } from "@/features/messages/messages";
import { speakCharacter } from "@/features/messages/speakCharacter";
import { MessageInputContainer } from "@/components/messageInputContainer";
import { SYSTEM_PROMPT } from "@/features/constants/systemPromptConstants";
import { DEFAULT_PARAM, KoeiroParam } from "@/features/constants/koeiroParam";
import { chat, getChatResponse } from "@/features/chat/openAiChat";
import { connect } from "@/features/blivedm/blivedm";
// import { PhotoFrame } from '@/features/game/photoFrame';
// import { M_PLUS_2, Montserrat } from "next/font/google";
import { Introduction } from "@/components/introduction";
import { Menu } from "@/components/menu";
import { GitHubLink } from "@/components/githubLink";
import { Meta } from "@/components/meta";
import { GlobalConfig, getConfig, initialFormData } from "@/features/config/configApi";
import { buildUrl } from "@/utils/buildUrl";
import { generateMediaUrl, vrmModelData } from "@/features/media/mediaApi";
import { VRMExpressionPresetName } from "@pixiv/three-vrm";
import { custoRoleFormData, customroleList } from "@/features/customRole/customRoleApi";

// const m_plus_2 = M_PLUS_2({
//   variable: "--font-m-plus-2",
//   display: "swap",
//   preload: false,
// });

// const montserrat = Montserrat({
//   variable: "--font-montserrat",
//   display: "swap",
//   subsets: ["latin"],
// });

let socketInstance: WebSocket | null = null;
let bind_message_event = false;
let webGlobalConfig = initialFormData
let roleList: any = null;
let curRole: any = null;
let autoQuestion: string | number | NodeJS.Timeout | null | undefined = null;
let idle_01: string | number | NodeJS.Timeout | null | undefined = null;

export default function Home() {
    const { viewer } = useContext(ViewerContext);
    const [systemPrompt, setSystemPrompt] = useState(SYSTEM_PROMPT);
    const [openAiKey, setOpenAiKey] = useState("");
    const [koeiroParam, setKoeiroParam] = useState<KoeiroParam>(DEFAULT_PARAM);
    const [chatProcessing, setChatProcessing] = useState(false);
    const [customRoles, setCustomRoles] = useState([custoRoleFormData]);
    const [chatLog, setChatLog] = useState<Message[]>([]);
    const [chatList, setChatList] = useState<Message[]>([]);
    const [assistantMessage, setAssistantMessage] = useState("");
    const [imageUrl, setImageUrl] = useState('');
    const [globalConfig, setGlobalConfig] = useState<GlobalConfig>(initialFormData);
    const [subtitle, setSubtitle] = useState("");
    const [displayedSubtitle, setDisplayedSubtitle] = useState("");
    const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>(buildUrl("/bg-c.png"));
    const typingDelay = 100; // 每个字的延迟时间，可以根据需要进行调整
    const MAX_SUBTITLES = 30;
    const chatListRef = useRef();

    const handleSubtitle = (newSubtitle: string) => {

        setDisplayedSubtitle((prevSubtitle: string) => {
            const updatedSubtitle = prevSubtitle + newSubtitle;
            if (updatedSubtitle.length > MAX_SUBTITLES) {
                const startIndex = updatedSubtitle.length - MAX_SUBTITLES;
                return updatedSubtitle.substring(startIndex);
            }
            return updatedSubtitle;
        });
    };

    // ============自动提问=============
    const aiAsk = () => {
        if (autoQuestion) {
            clearInterval(autoQuestion)
        }
        if (curRole && curRole.scenario && curRole.scenario.length > 0) {
            let messages: Message[] = [];
            let sysMsg: Message = { role: "user", content: `${curRole.scenario}`, user_name: "user" };
            console.log("自动提问-提示词-user：")
            console.log(curRole.scenario)
            autoQuestion = setInterval(() => {
                const params2 = JSON.parse(window.localStorage.getItem("chatVRMParams") as string);
                let indexPos = params2.chatList.findIndex((item: { played: boolean; }) => item.played == false);
                if (indexPos == -1 || params2.chatList.length - indexPos < 3) {
                    console.log("===>15s自动提问，列表长度： ", params2.chatList.length, " 当前播放：" + indexPos, " 剩余未播放：" + (params2.chatList.length - indexPos))

                    getChatResponse(messages.concat([sysMsg]).reverse()).then((data) => {
                        // try {
                        //     var jsonObj = JSON.parse(data);
                        //     console.log(jsonObj);

                        if (messages.length > 20) {
                            messages.shift();
                        }
                        messages.push({ role: "assistant", content: data, user_name: "assistant" })

                        // console.log({ content: content, user_name: content.split("：")[0] })
                        fetch('http://localhost:8000/chatbot/chat2', {
                            method: 'POST',
                            body: JSON.stringify({ content: data, user_name: ""/* content.split("：")[0] */ }),
                            headers: { 'Content-Type': 'application/json' },
                        }).then(response => response.json())
                            .then(data2 => console.log(data2))
                            .catch(error => console.error('Error:', error));
                        // } catch (error) {
                        //     // 捕获并处理异常
                        //     console.error('自动提问-解析异常: ', data);
                        // }
                    }).catch((e) => {
                        console.error(e);
                    });
                } else {
                    console.log("已有多个待回复内容", params2.chatList.length, " 当前播放：" + indexPos, " 剩余未播放：" + (params2.chatList.length - indexPos))
                }
            }, 1000 * 15);
        }
    }

    useEffect(() => {
        if (socketInstance != null) {
            socketInstance.close()
        }
        if (!bind_message_event) {
            console.log(">>>> setupWebSocket")
            bind_message_event = true;
            setupWebSocket(); // Set up WebSocket when component mounts

            getConfig().then(data => {
                webGlobalConfig = data
                setGlobalConfig(data)
                if (data.background_url != '') {
                    setBackgroundImageUrl(generateMediaUrl(data.background_url))
                }

                customroleList().then(data => {
                    roleList = data;
                    curRole = roleList.find((item: any) => item.id == webGlobalConfig.characterConfig.character)
                    console.log("当前角色参数：", curRole)

                    aiAsk();
                })
            })
        }
        if (window.localStorage.getItem("chatVRMParams")) {
            const params = JSON.parse(
                window.localStorage.getItem("chatVRMParams") as string
            );
            setSystemPrompt(params.systemPrompt);
            setKoeiroParam(params.koeiroParam);
            setChatLog(params.chatLog);

            params.chatList.map((item: { played: boolean; }) => item.played = true)
            window.localStorage.setItem(
                "chatVRMParams",
                JSON.stringify({ systemPrompt, koeiroParam, chatLog, chatList })
            )

            setChatList(params.chatList);


        }

    }, []);


    useEffect(() => {
        process.nextTick(() =>
            window.localStorage.setItem(
                "chatVRMParams",
                JSON.stringify({ systemPrompt, koeiroParam, chatLog, chatList })
            )
        );
    }, [systemPrompt, koeiroParam, chatLog, chatList]);

    const handleChangeChatLog = useCallback(
        (targetIndex: number, text: string) => {
            const newChatLog = chatLog.map((v: Message, i) => {
                return i === targetIndex ? { role: v.role, content: text, user_name: v.user_name } : v;
            });
            setChatLog(newChatLog);
        },
        [chatLog]
    );

    /**
     * 每句话串行点播声音并播放
     */
    const handleSpeakAi = useCallback(
        async (
            globalConfig: GlobalConfig,
            screenplay: Screenplay,
            onStart?: () => void,
            onEnd?: () => void
        ) => {
            speakCharacter(globalConfig, screenplay, viewer, onStart, onEnd);
        },
        [viewer]
    );

    const markMessageAsPlayed = useCallback((timeStamp: number | undefined) => {
        setChatList(prevChatList =>
            prevChatList.map(item =>
                item.time === timeStamp ? { ...item, played: true } : item
            )
        );
    }, [setChatList]);

    const handleUserMessage = useCallback((
        globalConfig: GlobalConfig,
        type: string,
        user_name: string,
        content: string,
        emote: [{ "emote": string, "time": number }],
        expand: string) => {

        // console.log("弹幕回复:" + expand)
        // 如果content为空，不进行处理
        // 如果与上一句content完全相同，不进行处理
        if (content == null || content == '' || content == ' ') {
            return
        }

        // const sentences = new Array<string>();
        let aiTextLog = "";
        let aiText = expand + " \n " + content;
        if (user_name) {
            aiText = user_name + " ： " + expand + " \n " + content;
        }

        const aiTalks = textsToScreenplay([aiText], koeiroParam, emote[0].emote);
        aiTextLog += aiText;

        // 回复队列
        const params = JSON.parse(window.localStorage.getItem("chatVRMParams") as string);
        if (!params.chatList) {
            params["chatList"] = [];
        }
        let sTime = new Date().getTime();
        const chatListMsgs: Message[] = [...params.chatList, { type, user_name, content, emote, expand, time: sTime, played: false }];
        setChatList(chatListMsgs);

        // 生成并播放每个句子的声音，显示回答
        // const currentAssistantMessage = sentences.join(" ");
        // setSubtitle(aiTextLog);

        // 播放队列
        handleSpeakAi(globalConfig, aiTalks[0], () => {
            idle_01 && clearTimeout(idle_01);

            let myTitle = expand + " \n ";
            if (user_name) {
                myTitle = user_name + " ： " + expand + " \n ";
            }
            setSubtitle(myTitle);

            handleBehaviorAction("behavior_action", "Happy Idle", emote);

            // setAssistantMessage(currentAssistantMessage);

            // handleSubtitle(aiText + " "); // 添加空格以区分不同的字幕
            // startTypewriterEffect(aiTextLog);

            // // 在日志中添加助手的回复
            // const params = JSON.parse(window.localStorage.getItem("chatVRMParams") as string);
            // const messageLogAssistant: Message[] = [...params.chatLog, { role: "assistant", content: aiTextLog, "user_name": user_name },];
            // setChatLog(messageLogAssistant);

            // // 滑到当前消息处
            // let indexPos = params.chatList.findIndex((item: any, index: number) => {
            //     if (item.time == sTime) {
            //         // params.chatList[index].played = true;
            //         return true;
            //     } else {
            //         return false;
            //     }
            // });
            // window.localStorage.setItem(
            //     "chatVRMParams",
            //     JSON.stringify({ systemPrompt, koeiroParam, chatLog, chatList: params.chatList })
            // )
            // if (indexPos != -1) {
            //     (chatListRef.current as any)?.scrollToMessage(indexPos);
            // }

        }, () => {
            // 标记消息为已读
            markMessageAsPlayed(sTime);

            idle_01 = setTimeout(() => {
                handleBehaviorAction("behavior_action", "idle_01", [{ "emote": "neutral", time: -1 }]);
            }, 2000);
        });
    }, [])

    const handleDanmakuMessage = (
        globalConfig: GlobalConfig,
        type: string,
        user_name: string,
        content: string,
        emote: [{ "emote": string, "time": number }],
        action: string) => {

        console.log("弹幕消息提问:" + content + " emote:", emote, " user_name:" + user_name)
        // 如果content为空，不进行处理
        // 如果与上一句content完全相同，不进行处理
        if (content == null || content == '' || content == ' ') {
            return
        }

        if (action != null && action != '') {
            console.log("动作：思考2")
            handleBehaviorAction("behavior_action", action, emote,);
        }

        // let aiTextLog = "";
        // const sentences = new Array<string>();
        // const aiText = content;
        // const aiTalks = textsToScreenplay([aiText], koeiroParam, emote);
        // aiTextLog += aiText;
        // // 生成并播放每个句子的声音，显示回答
        // setSubtitle(aiTextLog);

        // handleSpeakAi(globalConfig, aiTalks[0], () => {
        //     // setAssistantMessage(currentAssistantMessage);
        //     startTypewriterEffect(aiTextLog);
        //     // 在日志中添加助手的回复
        //     const params = JSON.parse(
        //         window.localStorage.getItem("chatVRMParams") as string
        //     );
        //     const messageLog: Message[] = [
        //         ...params.chatLog,
        //         { role: "user", content: content, "user_name": user_name },
        //     ];
        //     setChatLog(messageLog);

        // }, () => {
        //     console.log("动作：说完话2")
        //     if (action != null && action != '') {
        //         handleBehaviorAction(
        //             "behavior_action",
        //             "idle_01",
        //             "neutral",
        //         );
        //     }
        // });


    }

    const handleBehaviorAction = (type: string, anim: string, emotes: any[] = []) => {
        console.log("动作和表情:" + anim, " emotes:", emotes)
        // // 播放动作
        // viewer.model?.loadFBX(buildUrl(anim))
        // 播放表情
        // viewer.model?.emote(emote[0].emote as EmotionType)

        const actions: (() => Promise<boolean>)[] = [];
        for (const emote of emotes) {
            actions.push(() => new Promise((resolve, reject) => {
                console.log(emote)
                // 播放表情
                viewer.model?.emote(emote.emote as EmotionType);
                // 播放动作
                viewer.model?.loadFBX(buildUrl(emote.action ? emote.action : "idle_01"))
                setTimeout(() => {
                    resolve(true);
                }, emote.time * 1000);
            }));
        }
        async function runActionsSequentially() {
            for (const action of actions) {
                await action();
            }
        }
        runActionsSequentially().then(() => {
            console.log('表情动作播放完成');
        }).catch(error => {
            console.error('表情动作播放错误:', error);
        });

    }

    const startTypewriterEffect = (text: string) => {
        let currentIndex = 0;
        const subtitleInterval = setInterval(() => {
            const newSubtitle = text[currentIndex];
            handleSubtitle(newSubtitle);
            currentIndex++;
            if (currentIndex >= text.length) {
                clearInterval(subtitleInterval);
            }
        }, 100); // 每个字符的间隔时间
    };

    const handleSendChat = useCallback(async (globalConfig: GlobalConfig, type: string, user_name: string, content: string) => {
        console.log("1.键盘输入消息 UserMessage:" + content)

        setChatProcessing(true);

        console.log("动作：思考1")
        handleBehaviorAction("behavior_action", "thinking", [{ "emote": "happy", time: -1 }],);

        const yourName = user_name == null || user_name == '' ? globalConfig?.characterConfig?.yourName : user_name
        // 添加用户的发言并显示
        const messageLog: Message[] = [
            ...chatLog,
            { role: "user", content: content, "user_name": yourName },
        ];
        setChatLog(messageLog);

        await chat(content, yourName).catch(
            (e) => {
                console.error(e);
                return null;
            }
        );

        console.log("动作：说完话1")
        handleBehaviorAction("behavior_action", "idle_01", [{ "emote": "neutral", time: -1 }],);

        setChatProcessing(false);
    }, [systemPrompt, chatLog, setChatLog, handleSpeakAi, setImageUrl, openAiKey, koeiroParam]);

    let lastSwitchTime = 0;

    const onChangeGlobalConfig = useCallback((
        globalConfig: GlobalConfig) => {
        setGlobalConfig(globalConfig);
        webGlobalConfig = globalConfig;
    }, [])

    const handleWebSocketMessage = (event: MessageEvent) => {
        const data = event.data;
        const chatMessage = JSON.parse(data);
        const type = chatMessage.message.type;
        console.log("收到消息：", chatMessage)
        if (type === "user") {
            handleUserMessage(
                webGlobalConfig,
                chatMessage.message.type,
                chatMessage.message.user_name,
                chatMessage.message.content,
                chatMessage.message.emote,
                chatMessage.message.expand,
            );
        } else if (type === "behavior_action") {
            handleBehaviorAction(chatMessage.message.type, chatMessage.message.content, chatMessage.message.emote,);
        } else if (type === "danmaku") {
            handleDanmakuMessage(
                webGlobalConfig,
                chatMessage.message.type,
                chatMessage.message.user_name,
                chatMessage.message.content,
                chatMessage.message.emote,
                chatMessage.message.action
            );
        }
    };

    const setupWebSocket = () => {
        connect().then((webSocket) => {
            socketInstance = webSocket;
            socketInstance.onmessage = handleWebSocketMessage; // Set onmessage listener
            socketInstance.onclose = (event) => {
                console.log('WebSocket connection closed:', event);
                console.log('Reconnecting...');
                setupWebSocket(); // 重新调用connect()函数进行连接
            };
        });

        // let elist = [
        //     { "emote": VRMExpressionPresetName.Aa, "time": 5, anim: "idle_01" },
        //     { "emote": VRMExpressionPresetName.Ih, "time": 4, anim: "idle_02" },
        //     { "emote": VRMExpressionPresetName.Ou, "time": 5, anim: "idle_03" },
        //     { "emote": VRMExpressionPresetName.Ee, "time": 4, anim: "idle_happy_01" },
        //     { "emote": VRMExpressionPresetName.Oh, "time": 4, anim: "idle_happy_02" },
        //     { "emote": VRMExpressionPresetName.Blink, "time": 5, anim: "idle_happy_03" },
        //     { "emote": VRMExpressionPresetName.Happy, "time": 2, anim: "standing_greeting" },
        //     { "emote": VRMExpressionPresetName.Angry, "time": 4, anim: "thinking" },
        //     { "emote": VRMExpressionPresetName.Sad, "time": 3, anim: "Sitting Idle" },
        //     { "emote": VRMExpressionPresetName.Relaxed, "time": 4, anim: "Dance Snake Hip Hop" },
        //     { "emote": VRMExpressionPresetName.LookUp, "time": 4, anim: "Dance Thriller Part 2" },
        //     { "emote": VRMExpressionPresetName.Surprised, "time": 2, anim: "Dancing Hip Hop" },
        //     { "emote": VRMExpressionPresetName.LookDown, "time": 5, anim: "Standing Arguing" },
        //     { "emote": VRMExpressionPresetName.LookLeft, "time": 3, anim: "excited" },
        //     { "emote": VRMExpressionPresetName.LookRight, "time": 4, anim: "idle_01" },
        //     { "emote": VRMExpressionPresetName.BlinkLeft, "time": 3, anim: "idle_01" },
        //     { "emote": VRMExpressionPresetName.BlinkRight, "time": 4, anim: "idle_01" },
        //     { "emote": VRMExpressionPresetName.Neutral, "time": 4, anim: "idle_01" }
        // ]
        // setInterval(() => {
        //     // ["neutral", "happy", "angry", "sad", "relaxed"]
        //     handleBehaviorAction("behavior_action", "idle_01", elist);
        // }, 30000);
    }

    return (
        <div
            style={{
                backgroundImage: `url(${backgroundImageUrl})`,
                backgroundSize: 'cover',
                width: '100%',
                height: '100vh',
                position: 'relative',
                zIndex: 1,
                backgroundPosition: "center"
            }}>
            <div>
                <Meta />
                <Introduction openAiKey={openAiKey} onChangeAiKey={setOpenAiKey} />
                <VrmViewer globalConfig={globalConfig} />
                {/* <div className="flex items-center justify-center">
                    <div className="absolute bottom-1/4 z-10" style={{
                        fontFamily: "fzfs",
                        fontSize: "24px",
                        color: "#555",
                        // display: "none"
                    }}>
                        {displayedSubtitle}
                    </div>
                </div> */}
                {/* 消息输入框 */}
                {/* <MessageInputContainer
                    isChatProcessing={chatProcessing}
                    onChatProcessStart={handleSendChat}
                    globalConfig={globalConfig}
                /> */}

                {/* 当 subtitle 存在时才显示题目和答案区域 */}
                {subtitle && (
                    <div style={{
                        position: 'absolute',
                        top: '5%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '80%',
                        backgroundColor: '#2c3e50',
                        backgroundImage: 'url("blackboard-texture.png")',
                        color: '#ecf0f1',
                        padding: '20px',
                        borderRadius: '10px',
                        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.5)',
                        fontFamily: '"STKaiti", serif', // 高清正楷字体
                        fontSize: '24px',
                        textAlign: 'center',
                        lineHeight: '1.5',
                        boxSizing: 'border-box',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        fontWeight: 'bolder',
                        justifyContent: 'center'
                    }}>
                        <div style={{
                            textShadow: '0px 0px 3px rgba(255, 255, 255, 0.5)'
                        }}>{subtitle}</div>
                    </div>
                )}

                <Menu
                    globalConfig={globalConfig}
                    openAiKey={openAiKey}
                    systemPrompt={systemPrompt}
                    chatLog={chatLog}
                    chatList={chatList}
                    chatListRef={chatListRef}
                    koeiroParam={koeiroParam}
                    assistantMessage={assistantMessage}
                    onChangeAiKey={setOpenAiKey}
                    onChangeBackgroundImageUrl={data =>
                        setBackgroundImageUrl(generateMediaUrl(data))
                    }
                    onChangeSystemPrompt={setSystemPrompt}
                    onChangeChatLog={handleChangeChatLog}
                    onChangeKoeiromapParam={setKoeiroParam}
                    onChangeGlobalConfig={onChangeGlobalConfig}
                    handleClickResetChatLog={() => setChatLog([])}
                    handleClickResetSystemPrompt={() => setSystemPrompt(SYSTEM_PROMPT)}
                />
                <GitHubLink />
            </div>
        </div>
    )
}
