import { wait } from "@/utils/wait";
import { synthesizeVoice } from "../koeiromap/koeiromap";
import { Viewer } from "../vrmViewer/viewer";
import { Screenplay } from "./messages";
import { Talk } from "./messages";
import axios from 'axios';
import { postRequestArraybuffer } from "../httpclient/httpclient";
import { GlobalConfig } from "../config/configApi";


const createSpeakCharacter = () => {
  let lastTime = 0;
  let prevFetchPromise: Promise<unknown> = Promise.resolve();
  let prevSpeakPromise: Promise<unknown> = Promise.resolve();

  return (
    globalConfig: GlobalConfig,
    screenplay: Screenplay,
    viewer: Viewer,
    onStart?: () => void,
    onComplete?: () => void
  ) => {
    // 没有中英文则直接返回
    if (screenplay.talk.message.replace(/[^a-zA-Z\u4e00-\u9fa5]/g, '').trim().length <= 0) {
      onComplete?.();
      return;
    }

    const fetchPromise = prevFetchPromise.then(async () => {
      const now = Date.now();
      if (now - lastTime < 1000) {
        await wait(1000 - (now - lastTime));
      }

      const buffer = await fetchAudio(screenplay.talk, globalConfig).catch(() => null);
      lastTime = Date.now();
      return buffer;
    });

    prevFetchPromise = fetchPromise;
    prevSpeakPromise = Promise.all([fetchPromise, prevSpeakPromise])
      .then(([audioBuffer]) => {
        onStart?.();
        if (!audioBuffer) {
          return;
        }
        return viewer.model?.speak(audioBuffer, screenplay);
      }).catch(e => {
        onComplete?.();
      })
    prevSpeakPromise.then(() => {
      onComplete?.();
    });
  };
}

export const speakCharacter = createSpeakCharacter();

export const fetchAudio = async (talk: Talk, globalConfig: GlobalConfig): Promise<ArrayBuffer> => {
  // const ttsVoice = await synthesizeVoice(
  //   talk.message,
  //   talk.speakerX,
  //   talk.speakerY,
  //   talk.style
  // );
  // const url = ttsVoice.audio;
  // if (url == null) {
  //   throw new Error("Something went wrong");
  // }

  // const resAudio = await fetch(url);
  // const buffer = await resAudio.arrayBuffer();
  // return buffer;

  const requestBody = {
    text: talk.message,
    voice_id: globalConfig.ttsConfig.ttsVoiceId,
    type: globalConfig.ttsConfig.ttsType
  };

  const headers = {
    'Content-Type': 'application/json',
  }

  const data = await postRequestArraybuffer("/speech/tts/generate", headers, requestBody);
  return data;
};
