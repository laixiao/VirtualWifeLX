import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Message } from "@/features/messages/messages";
import { GlobalConfig } from "@/features/config/configApi";
type Props = {
  globalConfig: GlobalConfig;
  messages: Message[];
  ref: any;
};

export interface ChatListMethods {
  scrollToMessage: (index: number) => void; // 这个方法接受一个数字作为参数，并且没有返回值
}
let scrollToIndex = 0; // 新状态来追踪滚动到的消息索引

// export const ChatList = ({ messages, globalConfig }: Props) => {
export const ChatList = forwardRef<ChatListMethods, Props>(({ messages, globalConfig }, ref) => {
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useImperativeHandle(ref, () => ({
    scrollToMessage: (index: number) => {
      scrollToIndex = index;

      const messageElement = messageRefs.current[index];
      if (messageElement) {
        messageElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    }
  }));

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({
      behavior: "auto",
      block: "center",
    });
  }, []);

  useEffect(() => {
    messageRefs.current = messageRefs.current.slice(0, messages.length);
  }, [messages]);


  useEffect(() => {//添加子项滚动
    // chatScrollRef.current?.scrollIntoView({
    //   behavior: "smooth",
    //   block: "center",
    // });
  }, [messages]);
  return (
    <div className="absolute max-w-full h-[100svh] chat-list">
      <div className="max-h-full pt-104 overflow-y-auto scroll-hidden">
        {messages.map((msg, i) => {
          return (
            <div key={i} ref={el => messageRefs.current[i] = el}>
              <Chat role={msg.expand ? msg.expand : ""} message={msg.content} user_name={msg.user_name} globalConfig={globalConfig} i={i} />
            </div>
          );
        })}

        {/* 新增半屏高度的白色块 */}
        <div style={{ height: '60vh' }}></div>
      </div>
    </div>
  );
});


const Chat = ({ role, message, user_name, globalConfig, i: i }: { role: string; message: string; user_name: string; globalConfig: GlobalConfig, i: number }) => {
  // 检查角色是否是用户
  // const roleColor = "bg-secondary text-white";
  const bgColor = i >= scrollToIndex ? '' : 'bg-color-nocur strikethrough';
  const roleColor = i >= scrollToIndex ? 'bg-secondary text-white' : 'bg-base text-primary strikethrough';
  const roleText = i >= scrollToIndex ? "text-secondary" : "text-primary";
  const showhide = i >= scrollToIndex+1 ? "dis-none" : "";
  const offsetX = "pr-40";

  return (
    <div className={`mx-auto chat-list-item ${offsetX} ${bgColor}`}>
      <div className={`px-24 py-8 rounded-t-8 font-Montserrat font-bold tracking-wider ${roleColor}`}>
        {user_name+'：'+role}
      </div>
      <div className={`px-24 py-16 bg-white rounded-b-8 `}>
        <div className={`typography-16 font-M_PLUS_2 font-bold ${roleText} ${showhide}`}>
          {message}
        </div>
      </div>
    </div>
  );
};

