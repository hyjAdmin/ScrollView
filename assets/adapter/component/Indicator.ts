const { ccclass, property } = cc._decorator;
import { PageViewManager } from '../manager/PageViewManager';
import { ScrollAdapter } from '../ScrollAdapter';
@ccclass
export class Indicator extends cc.Component {
    @property(ScrollAdapter) adapter: ScrollAdapter<any> = null
    @property({
        type: cc.SpriteFrame,
    }) spriteFrame: cc.SpriteFrame = null
    @property cellSize: cc.Size = new cc.Size(10, 10)
    @property spacing: number = 10
    private _indicators: cc.Node[] = []
    private _layout: cc.Layout = null
    private _color: cc.Color = new cc.Color()
    get layout() {
        if (this._layout == null) {
            this._layout = this.getComponent(cc.Layout) || this.addComponent(cc.Layout)
            if (this.adapter.isHorizontal) {
                this._layout.type = cc.Layout.Type.HORIZONTAL
                this._layout.spacingX = this.spacing
            } else {
                this._layout.type = cc.Layout.Type.VERTICAL
                this._layout.spacingY = this.spacing
            }
            this._layout.resizeMode = cc.Layout.ResizeMode.CONTAINER
        }
        return this._layout
    }
    protected __preload() {
        if (this.adapter) {
            this.adapter.pageViewManager.on(PageViewManager.Event.ON_PAGE_LENGTH_CHANGED, this.onPageLengthChanged, this)
            this.adapter.pageViewManager.on(PageViewManager.Event.ON_SCROLL_PAGE_END, this.onScrollPageEnd, this)
        }
    }
    private onScrollPageEnd() {
        this.changedState()
    }
    private onPageLengthChanged() {
        if (!this.adapter) return
        const indicators = this._indicators
        const length = this.adapter.viewManager.viewLength
        if (length === indicators.length) {
            return
        }
        let i = 0
        if (length > indicators.length) {
            for (i = 0; i < length; ++i) {
                if (!indicators[i]) {
                    indicators[i] = this.createIndicator()
                }
            }
        } else {
            const count = indicators.length - length
            for (i = count; i > 0; --i) {
                const transform = indicators[i - 1]
                this.node.removeChild(transform)
                indicators.splice(i - 1, 1)
            }
        }
        if (this.layout && this.layout.enabledInHierarchy) {
            this.layout.updateLayout()
        }
        this.changedState()
    }

    private createIndicator() {
        const node = new cc.Node()
        // node.layer = this.node.layer
        const sprite = node.addComponent(cc.Sprite)
        sprite.spriteFrame = this.spriteFrame
        sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM
        node.parent = this.node
        // var transform = node.getComponent(UITransform)
        node.setContentSize(this.cellSize)
        return node
    }
    changedState() {
        const indicators = this._indicators
        if (indicators.length === 0 || !this.adapter) return

        const idx = this.adapter.pageViewManager.currentIndex
        if (idx >= indicators.length) return
        for (let i = 0; i < indicators.length; ++i) {
            const transform = indicators[i]
            // const comp = transform.getComponent(cc.Sprite)
            this._color.set(transform.color)
            this._color.setA(255 / 2)
            transform.color = this._color
        }
        if (indicators[idx]) {
            const comp = indicators[idx]
            this._color.set(comp.color)
            this._color.setA(255)
            comp.color = this._color
        }
    }
}

