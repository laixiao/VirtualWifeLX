import * as THREE from "three";
import { Model } from "./model";
import { loadVRMAnimation } from "@/lib/VRMAnimation/loadVRMAnimation";
import { buildUrl } from "@/utils/buildUrl";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { loadMixamoAnimation } from "../mixamo/loadMixamoAnimation";

/**
 * three.jsを使った3Dビューワー
 *
 * setup()でcanvasを渡してから使う
 */
export class Viewer {
  public isReady: boolean;
  public model?: Model;

  private _renderer?: THREE.WebGLRenderer;
  private _clock: THREE.Clock;
  private _scene: THREE.Scene;
  private _camera?: THREE.PerspectiveCamera;
  private _cameraControls?: OrbitControls;

  constructor() {
    this.isReady = false;

    // scene
    const scene = new THREE.Scene();
    this._scene = scene;

    // light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(1.0, 1.0, 1.0).normalize();
    scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // animate
    this._clock = new THREE.Clock();
    this._clock.start();
  }

  public loadVrm(url: string) {
    if (this.model?.vrm) {
      this.unloadVRM();
    }

    // gltf and vrm
    this.model = new Model(this._camera || new THREE.Object3D());
    this.model.loadVRM(url).then(async () => {
      if (!this.model?.vrm) return;

      // Disable frustum culling
      this.model.vrm.scene.traverse((obj) => {
        obj.frustumCulled = false;
      });

      // 修改相机的位置
      // this._camera?.position.set(0, 0, 2.0);  // 把相机位置设为 (0, 2.6, 3.0) 

      this._scene.add(this.model.vrm.scene);

      const animations = [
        { name: "relaxed_idle_01", path: "daily", description: "idle" },
        { name: "Neutral_Idle_1", path: "daily", description: "idle" },
        { name: "Angry_1", path: "daily", description: "idle" },
        { name: "Sad_Idle_1", path: "daily", description: "idle" },
        { name: "idle_happy_1", path: "daily", description: "idle" },

        { name: "idle_01", path: "daily", description: "Basic idle" },
        { name: "idle_02", path: "daily", description: "Alternate idle" },
        { name: "idle_03", path: "daily", description: "Variation of idle" },
        { name: "idle_happy_01", path: "daily", description: "Happy idle 1" },
        { name: "idle_happy_02", path: "daily", description: "Happy idle 2" },
        { name: "idle_happy_03", path: "daily", description: "Happy idle 3" },
        { name: "idle_happy_01", path: "daily", description: "Happy idle 4" },
        { name: "standing_greeting", path: "daily", description: "Greeting" },
        { name: "thinking", path: "daily", description: "Thinking pose" },
        { name: "Dance Snake Hip Hop", path: "daily", description: "Snake dance" },
        { name: "Dance Thriller Part 2", path: "daily", description: "Thriller dance" },
        { name: "Dancing Hip Hop", path: "daily", description: "Hip hop dance" },
        { name: "Standing Arguing", path: "daily", description: "Arguing" },

        { name: "CatwalkWalk", path: "daily", description: "CatwalkWalk" },
        
        { name: "excited", path: "emote", description: "Excited" },
      ];
      let loadAnimation = async (animation: { name: string; path: string; description?: string }) => {
        if (this.model && this.model.vrm) {
          this.model.clipMap.set(animation.name, await loadMixamoAnimation(buildUrl(`${animation.path}/${animation.name}.fbx`), this.model.vrm));
        }
      }
      for (const animation of animations) {
        await loadAnimation(animation);
      }


      // const vrma = await loadVRMAnimation(buildUrl("/idle_loop.vrma"));
      // if (vrma) this.model.loadAnimation(vrma);
      this.model.loadFBX("CatwalkWalk")

      // HACK: アニメーションの原点がずれているので再生後にカメラ位置を調整する
      requestAnimationFrame(() => {
        this.resetCamera();
      });
    });
  }

  public unloadVRM(): void {
    if (this.model?.vrm) {
      this._scene.remove(this.model.vrm.scene);
      this.model?.unLoadVrm();
    }
  }

  /**
   * Reactで管理しているCanvasを後から設定する
   */
  public setup(canvas: HTMLCanvasElement) {
    const parentElement = canvas.parentElement;
    const width = parentElement?.clientWidth || canvas.width;
    const height = parentElement?.clientHeight || canvas.height;
    // renderer
    this._renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
    });
    this._renderer.outputEncoding = THREE.sRGBEncoding;
    this._renderer.setSize(width, height);
    this._renderer.setPixelRatio(window.devicePixelRatio);

    // camera
    this._camera = new THREE.PerspectiveCamera(20.0, width / height, 0.1, 20.0);
    this._camera.position.set(0, 1.3, 1.5);
    this._cameraControls?.target.set(0, 1.3, 0);
    this._cameraControls?.update();
    // camera controls
    this._cameraControls = new OrbitControls(
      this._camera,
      this._renderer.domElement
    );
    this._cameraControls.screenSpacePanning = true;
    this._cameraControls.update();

    window.addEventListener("resize", () => {
      this.resize();
    });
    this.isReady = true;
    this.update();
  }

  /**
   * canvasの親要素を参照してサイズを変更する
   */
  public resize() {
    if (!this._renderer) return;

    const parentElement = this._renderer.domElement.parentElement;
    if (!parentElement) return;

    this._renderer.setPixelRatio(window.devicePixelRatio);
    this._renderer.setSize(
      parentElement.clientWidth,
      parentElement.clientHeight
    );

    if (!this._camera) return;
    this._camera.aspect =
      parentElement.clientWidth / parentElement.clientHeight;
    this._camera.updateProjectionMatrix();
  }

  /**
   * VRMのheadノードを参照してカメラ位置を調整する
   */
  public resetCamera() {
    const headNode = this.model?.vrm?.humanoid.getNormalizedBoneNode("head");

    if (headNode) {
      const headWPos = headNode.getWorldPosition(new THREE.Vector3());
      this._camera?.position.set(
        this._camera.position.x,
        headWPos.y,
        this._camera.position.z
      );
      this._cameraControls?.target.set(headWPos.x, headWPos.y, headWPos.z);
      this._cameraControls?.update();
    }
  }

  public update = () => {
    requestAnimationFrame(this.update);
    const delta = this._clock.getDelta();
    // update vrm components
    if (this.model) {
      this.model.update(delta);
    }

    if (this._renderer && this._camera) {
      this._renderer.render(this._scene, this._camera);
    }
  };
}
