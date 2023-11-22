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
import { playAnim } from "@/utils/ExpressionUtil";

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
let autoInterval: string | number | NodeJS.Timeout | null | undefined = null;
let msgList: any[] = [];
let speaking: boolean = false;

export default function Home() {
    const { viewer } = useContext(ViewerContext);
    const [systemPrompt, setSystemPrompt] = useState(SYSTEM_PROMPT);
    const [openAiKey, setOpenAiKey] = useState("");
    const [koeiroParam, setKoeiroParam] = useState<KoeiroParam>(DEFAULT_PARAM);
    const [chatProcessing, setChatProcessing] = useState(false);
    const [customRoles, setCustomRoles] = useState([custoRoleFormData]);
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
        if (autoInterval) {
            clearInterval(autoInterval)
        }
        if (curRole && curRole.scenario && curRole.scenario.length > 0) {
            let messages: Message[] = [];
            let sysMsg: Message = { role: "user", content: `${curRole.scenario}`, user_name: "user" };
            console.log("自动提问-提示词-user：", curRole.scenario)

            autoInterval = setInterval(() => {
                if (msgList.length < 5) {
                    console.log("===>15s自动提问，列表剩余长度： ", msgList.length)

                    getChatResponse(messages.concat([sysMsg]).reverse()).then((data) => {
                        // try {
                        //     var jsonObj = JSON.parse(data);
                        //     console.log(jsonObj);

                        if (messages.length > 20) {
                            messages.shift();
                        }
                        messages.push({ role: "assistant", content: data, user_name: "assistant" })

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
                    console.log("列表剩余长度：", msgList.length)
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
        }

    }, []);


    useEffect(() => {
        process.nextTick(() =>
            window.localStorage.setItem(
                "chatVRMParams",
                JSON.stringify({ systemPrompt, koeiroParam })
            )
        );
    }, [systemPrompt, koeiroParam]);


    const popMsg = useCallback((globalConfig: GlobalConfig) => {
        if (msgList.length > 0) {
            if (!speaking) {
                speaking = true;
                let msg = msgList.shift();
                console.log("2.播放消息：", msg)

                // const sentences = new Array<string>();
                // let aiTextLog = "";

                let quationStr = msg.expand + " \n ";
                if (msg.user_name) {
                    quationStr = msg.user_name + " ： " + msg.expand + " \n ";
                }
                // 生成并播放每个句子的声音，显示回答
                // const currentAssistantMessage = sentences.join(" ");
                // setSubtitle(aiTextLog);

                // 播放队列
                speakCharacter(globalConfig, quationStr + msg.content, viewer, () => {
                    // 开始播放
                    setSubtitle(quationStr);
                    handleEmotes(msg.emote);

                    playAnim(viewer, "talk")
                }, () => {
                    speaking = false;
                    popMsg(webGlobalConfig);
                });
            }
        } else {
            if (!speaking) {
                console.log("完成播放")
                handleEmotes([{ "emote": "neutral", time: -1 }]);
                playAnim(viewer, "idle")
            }
        }

    }, [viewer])

    const handleEmotes = (emotes: any[] = []) => {
        console.log("播放表情:", emotes)
        const emoteArry: Promise<any>[] = [];
        let emoteOnce = (emote: { emote: string; time: number; }) => {
            return new Promise((resolve, reject) => {
                // 播放表情
                viewer.model?.emote(emote.emote as EmotionType);
                setTimeout(() => {
                    resolve(true);
                }, emote.time > 0 ? emote.time * 1000 : 0);
            })
        }
        for (const emote of emotes) {
            emoteArry.push(emoteOnce(emote));
        }
        let excuseTask = () => {
            if (emoteArry.length > 0) {
                emoteArry.shift()?.then(() => {
                    excuseTask();
                })
            } else {
                console.log('表情播放完成');
            }
        }
        excuseTask();
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

    // 键盘输入
    // const handleSendChat = useCallback(async (globalConfig: GlobalConfig, type: string, user_name: string, content: string) => {
    //     const yourName = user_name == null || user_name == '' ? globalConfig?.characterConfig?.yourName : user_name
    //     console.log("1.键盘输入消息 UserMessage:", yourName, content)

    //     setChatProcessing(true);

    //     console.log("动作：思考1")
    //     handleEmotes([{ "emote": "happy", time: -1 }]);

    //     await chat(content, yourName).catch(
    //         (e) => {
    //             console.error(e);
    //             return null;
    //         }
    //     );

    //     console.log("动作：说完话1")
    //     handleEmotes([{ "emote": "neutral", time: -1 }]);

    //     setChatProcessing(false);
    // }, [systemPrompt, setImageUrl, openAiKey, koeiroParam]);

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

        if (type === "user") {
            console.log("1.收到消息-回复弹幕：", chatMessage)
            // 回复弹幕
            if ((chatMessage.message.content as string).trim()) {
                msgList.push(chatMessage.message);
            }
            popMsg(webGlobalConfig);
        } else if (type === "behavior_action") {
            // handleEmotes(chatMessage.message.emote);
        } else if (type === "danmaku") {
            console.log("1.收到消息-弹幕提问：", chatMessage)
            // if ((chatMessage.message.content as string).trim()) {
            //     msgList.push(chatMessage.message);
            // }
            // handleUserMessage(webGlobalConfig);
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
        // 测试
        // let elist = [
        //     { "emote": VRMExpressionPresetName.Aa, "time": 5, anim: "idle_01" },
        //     { "emote": VRMExpressionPresetName.Ih, "time": 4, anim: "idle_02" },
        //     { "emote": VRMExpressionPresetName.Ou, "time": 5, anim: "idle_03" },
        //     { "emote": VRMExpressionPresetName.Ee, "time": 4, anim: "idle_happy_01" },
        //     { "emote": VRMExpressionPresetName.Oh, "time": 4, anim: "idle_happy_02" },
        //     { "emote": VRMExpressionPresetName.Blink, "time": 5, anim: "idle_happy_03" },
        //     { "emote": VRMExpressionPresetName.Happy, "time": 2, anim: "standing_greeting" },
        //     { "emote": VRMExpressionPresetName.Angry, "time": 4, anim: "thinking" },
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
        //     handleEmotes("behavior_action", "idle_01", elist);
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
                    chatLog={[]}
                    chatList={[]}
                    chatListRef={chatListRef}
                    koeiroParam={koeiroParam}
                    assistantMessage={assistantMessage}
                    onChangeAiKey={setOpenAiKey}
                    onChangeBackgroundImageUrl={data =>
                        setBackgroundImageUrl(generateMediaUrl(data))
                    }
                    onChangeSystemPrompt={setSystemPrompt}
                    onChangeChatLog={() => { }}
                    onChangeKoeiromapParam={setKoeiroParam}
                    onChangeGlobalConfig={onChangeGlobalConfig}
                    handleClickResetChatLog={() => { }}
                    handleClickResetSystemPrompt={() => setSystemPrompt(SYSTEM_PROMPT)}
                />
                <GitHubLink />
            </div>
        </div>
    )
}
