import { buildUrl } from "./buildUrl";
/**
 * 情绪管理
 */
export function playAnim(viewer: any, type: string) {
  let animName = null;
  let anims: string | any[] = [];
  if (type == "idle") {
    // anims = ["idle_01", "idle_02", "idle_03"];
    anims = ["CatwalkWalk"];
  }
  if (type == "talk") {
    anims = ["Talking1", "Talking2", "Talking3", "Talking4", "Talking5"];
  }

  if (viewer.model) {
    animName = anims[Math.floor(Math.random() * anims.length)]
    console.log("播放动作:", animName)
    viewer.model.loadFBX(buildUrl(animName))
  }
}
