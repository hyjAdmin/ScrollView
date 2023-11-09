import { Holder } from '../../adapter/abstract/Holder';
import { View } from '../../adapter/abstract/View';
import { ViewManager } from '../../adapter/manager/ViewManager';
import { ScrollAdapter } from '../../adapter/ScrollAdapter';
import { chatHolder } from './chatHolder';
import { chatView } from './chatView';
const { ccclass, property } = cc._decorator;
export interface IChatModel {
    type: 0 | 1;
    message: string;
    facial: cc.SpriteFrame;
}
@ccclass
export class chatAdapter extends ScrollAdapter<IChatModel> {
    @property(cc.Node) mePrefab: cc.Node = null;
    @property(cc.Node) youPrefab: cc.Node = null;
    @property(cc.EditBox) input: cc.EditBox = null;
    @property(cc.Node) facialPanel: cc.Node = null;
    @property(cc.Node) footerButton: cc.Node = null;
    @property(cc.Label) moreLabel: cc.Label = null;
    @property(cc.SpriteFrame) spriteFrames: cc.SpriteFrame[] = [];
    private replyMsg: string;
    private replySp: cc.SpriteFrame;
    private moreTotal: number = 0;
    getPrefab(data: IChatModel): cc.Node | cc.Prefab {
        if (data.type == 0) {
            return this.mePrefab;
        } else {
            return this.youPrefab;
        }
    }
    getView(): View {
        return new chatView(this);
    }
    getHolder(node: cc.Node, code: string): Holder {
        return new chatHolder(node, code, this);
    }
    onLoad() {
        this.footerButton.active = false;
        this.moreLabel.string = '';
        this.moreTotal = 0;
        this.viewManager.on(ViewManager.Event.ON_MAGNETIC, this.onMagnetic, this);
    }
    onSend() {
        if (!this.input.string) return;
        this.unschedule(this.replyText);
        this.replyMsg = this.input.string;
        this.createMessage(0, this.input.string, null);
        this.scheduleOnce(this.replyText, 1);
    }
    replyText() {
        if (this.replyMsg) {
            this.createMessage(1, this.replyMsg, null);
        }
    }
    replySprite() {
        if (this.replySp) {
            this.createMessage(1, null, this.replySp);
        }
    }
    createMessage(type: 0 | 1, message: string, facial: cc.SpriteFrame) {
        var model: IChatModel = {
            type: type,
            message: message,
            facial: facial,
        };
        this.moreTotal++;
        this.modelManager.insert(model);
    }
    onMagnetic(ok: boolean) {
        if (ok) {
            this.moreTotal = 0;
        }
        if (this.moreTotal == 0) {
            this.footerButton.active = false;
        } else {
            this.footerButton.active = !ok;
        }
        this.moreLabel.string = this.moreTotal + '';
    }
    onOpenFacial() {
        this.facialPanel.active = !this.facialPanel.active;
    }
    onClickFacial(event: any, index: number) {
        var facial = this.spriteFrames[index];
        this.unschedule(this.replySprite);
        this.replySp = facial;
        this.createMessage(0, null, facial);
        this.scheduleOnce(this.replySprite, 1);
        this.facialPanel.active = false;
    }
}
