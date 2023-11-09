import { ScrollAdapter } from '../../adapter/ScrollAdapter';
const { ccclass, property } = cc._decorator;

@ccclass
export class chatitem extends cc.Component {
    @property(cc.Label) message: cc.Label = null;
    @property(cc.Sprite) facial: cc.Sprite = null;
    @property(cc.Node) background: cc.Node = null;
    @property(cc.Node) tweenNode: cc.Node = null;

    private adapter: ScrollAdapter<any>;

    onLoad() {}

    show(data: any, index: number, adapter: ScrollAdapter<any>) {
        // console.error("宽度", this.transform.width)
        if (!data.tweenFinish) {
            this.tweenNode.setPosition(adapter.viewCrossSize, 0);
        }
        this.adapter = adapter;
        this.unschedule(this.delayChangeSize);
        var size = cc.size(0, 0);
        if (data.message) {
            this.message.node.active = true;
            this.message.overflow = cc.Label.Overflow.NONE;
            this.message.string = `${data.message}`;
            // @ts-ignore
            this.message._forceUpdateRenderData(true);
            var maxWidth = adapter.viewCrossSize - 300;
            if (this.message.node.width >= maxWidth) {
                this.message.overflow = cc.Label.Overflow.RESIZE_HEIGHT;
                this.message.node.width = maxWidth;
            }
            size = this.message.node.getContentSize();
            this.setMsgBackground();
            this.scheduleOnce(this.delayChangeSize);
        } else {
            this.message.node.active = false;
        }
        if (data.facial) {
            this.facial.node.active = true;
            this.facial.spriteFrame = data.facial;
            size = this.facial.node.getContentSize();
            this.node.height = size.height + 70;
            this.setBackground();
        } else {
            this.facial.node.active = false;
        }
        // console.log("高度", size)
        // 只有最后一个做动画
        if (this.adapter.viewManager.viewLength - 1 == index) {
            if (!data.tweenFinish) {
                if (data.type == 0) {
                    this.tweenNode.setPosition(size.width + 150, 0);
                } else {
                    this.tweenNode.setPosition(-(size.width + 150), 0);
                }
                cc.tween(this.tweenNode)
                    .to(
                        0.5,
                        {
                            position: cc.v3(0, 0),
                        },
                        { easing: 'quintOut' }
                    )
                    .start();
                data.tweenFinish = true;
            }
        } else {
            this.tweenNode.setPosition(0, 0);
            data.tweenFinish = true;
        }
    }
    private delayChangeSize() {
        var height = this.message.node.height + 70;
        this.node.height = height;
        this.setMsgBackground();
    }
    private setBackground() {
        var temp = cc.size(Math.max(55, this.facial.node.width + 20), Math.max(55, this.facial.node.height + 35));
        this.background.setContentSize(temp);
    }
    private setMsgBackground() {
        var offset = this.message.overflow == cc.Label.Overflow.RESIZE_HEIGHT ? 35 : 0;
        var temp = cc.size(Math.max(55, this.message.node.width + 35), Math.max(55, this.message.node.height + offset));
        this.background.setContentSize(temp);
    }
}
