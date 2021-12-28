import EditorNodeMixin from "./EditorNodeMixin";
import { PlaneBufferGeometry, MeshBasicMaterial, Mesh, DoubleSide } from "three";
import audioIconUrl from "../../assets/audio-icon.png";
import AudioSource from "../objects/AudioSource";
import loadTexture from "../utils/loadTexture";
import { RethrownError } from "../utils/errors";
import { AudioType, DistanceModelType } from "../objects/AudioParams";

let audioHelperTexture = null;

export default class OmiAudioEmitterNode extends EditorNodeMixin(AudioSource) {
  static componentName = "omi-audio-emitter";

  static nodeName = "OmiAudioEmitter";

  static async load() {
    audioHelperTexture = await loadTexture(audioIconUrl);
  }

  static async deserialize(editor, json, loadAsync, onError) {
    const node = await super.deserialize(editor, json);

    const audioComp = json.components.find(c => c.name === "omi-audio-emitter");
    const { 
            src, 
            controls,
            autoPlay,
            nodeName,
            loop,
            audioType,
            gain,
            distanceModel,
            rolloffFactor,
            refDistance,
            maxDistance,
            coneInnerAngle,
            coneOuterAngle,
            coneOuterGain      
          } = audioComp.props;

    loadAsync(
      (async () => {
        await node.load(src, onError);
        node.controls = controls || false;
        node.autoPlay = autoPlay;
        node.name = nodeName;
        node.loop = loop;
        node.audioType = audioType;
        node.gain = gain;
        node.distanceModel = distanceModel;
        node.rolloffFactor = rolloffFactor;
        node.refDistance = refDistance;
        node.maxDistance = maxDistance;
        node.coneInnerAngle = coneInnerAngle;
        node.coneOuterAngle = coneOuterAngle;
        node.coneOuterGain = coneOuterGain;
      })()
    );

    return node;
  }

  constructor(editor) {
    super(editor, editor.audioListener);

    this._canonicalUrl = "";
    this._nodeName = "";
    this._autoPlay = true;
    this.controls = true;

    const geometry = new PlaneBufferGeometry();
    const material = new MeshBasicMaterial();
    material.map = audioHelperTexture;
    material.side = DoubleSide;
    material.transparent = true;
    this.helper = new Mesh(geometry, material);
    this.helper.layers.set(1);
    this.add(this.helper);
  }

  get src() {
    return this._canonicalUrl;
  }

  set src(value) {
    this.load(value).catch(console.error);
  }

  get nameVal() {
    return this._nodeName;
  }

  set nameVal(value) {
    this.load(value).catch(console.error);
  }

  get autoPlay() {
    return this._autoPlay;
  }

  set autoPlay(value) {
    this._autoPlay = value;
  }

  async load(src, onError) {
    const nextSrc = src || "";

    if (nextSrc === this._canonicalUrl && nextSrc !== "") {
      return;
    }

    this._canonicalUrl = src || "";

    this.helper.visible = false;
    this.hideErrorIcon();
    this.showLoadingCube();

    if (this.editor.playing) {
      this.el.pause();
    }

    try {
      const { accessibleUrl, contentType } = await this.editor.api.resolveMedia(src);

      await super.load(accessibleUrl, contentType);

      if (this.editor.playing && this.autoPlay) {
        this.el.play();
      }

      this.helper.visible = true;
    } catch (error) {
      this.showErrorIcon();

      const audioError = new RethrownError(`Error loading audio ${this._canonicalUrl}`, error);

      if (onError) {
        onError(this, audioError);
      }

      console.error(audioError);
    }

    this.editor.emit("objectsChanged", [this]);
    this.editor.emit("selectionChanged");
    this.hideLoadingCube();

    return this;
  }

  onPlay() {
    if (this.autoPlay) {
      this.el.play();
    }
  }

  onPause() {
    this.el.pause();
    this.el.currentTime = 0;
  }

  clone(recursive) {
    return new this.constructor(this.editor, this.audioListener).copy(this, recursive);
  }

  copy(source, recursive = true) {
    if (recursive) {
      this.remove(this.helper);
    }

    super.copy(source, recursive);

    if (recursive) {
      const helperIndex = source.children.findIndex(child => child === source.helper);

      if (helperIndex !== -1) {
        this.helper = this.children[helperIndex];
      }
    }

    this._canonicalUrl = source._canonicalUrl;
    this.controls = source.controls;

    return this;
  }

  prepareForExport() {
    super.prepareForExport();
    this.remove(this.helper);
    this.addGLTFComponent("omi-audio-emitter", {
      "audioSources": [
        {
          src: this._canonicalUrl,
          name: this.name,
          controls: this.controls,
          autoPlay: this.autoPlay,
          loop: this.loop    
        }
      ],
      "audioEmitters": [
        {
          audioType: this.audioType,
          gain: this.gain,
          distanceModel: this.audioType === AudioType.Stereo ? DistanceModelType.Linear : this.distanceModel,
          rolloffFactor: this.audioType === AudioType.Stereo ? 0 : this.rolloffFactor,
          refDistance: this.refDistance,
          maxDistance: this.maxDistance,
          coneInnerAngle: this.coneInnerAngle,
          coneOuterAngle: this.coneOuterAngle,
          coneOuterGain: this.coneOuterGain    
        }
      ]
    });
    this.replaceObject();
  }
}
