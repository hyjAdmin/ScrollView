const { ccclass, property } = cc._decorator;
import { Orientation, ScrollbarDirection } from '../enum/enum';
import { Mathf } from '../helper/Mathf';
import { ScrollManager } from '../manager/ScrollManager';
import { ScrollAdapter } from '../ScrollAdapter';
const MIN_SIZE_PERCENTAGE = 0.01
@ccclass
export class Scrollbar extends cc.Component {
    @property(ScrollAdapter) adapter: ScrollAdapter<any> = null
    @property(cc.Sprite) handle: cc.Sprite = null
    @property({
        type: cc.Enum(ScrollbarDirection)
    }) direction: ScrollbarDirection = ScrollbarDirection.Top_To_Bottom
    private _isDirty: boolean = false
    private _size: number = 0
    get size() { return this._size }
    set size(v: number) {
        if (v != this._size) {
            this._size = Mathf.clamp(v, MIN_SIZE_PERCENTAGE, 1)
            this._isDirty = true
        }
    }
    private _value: number = -1
    get value() { return this._value }
    set value(v: number) {
        if (v != this._value) {
            this._value = v
            this._isDirty = true
        }
    }
    get transform() {
        return this.node
    }
    private _handleTransform: cc.Node
    get handleTransform() {
        if (!this.handle) return null
        if (!this._handleTransform) {
            this._handleTransform = this.handle.node
        }
        return this._handleTransform
    }
    protected get xy() { return this.axis == Orientation.Horizontal ? "x" : "y" }
    protected get wh() { return this.axis == Orientation.Horizontal ? "width" : "height" }

    get axis() {
        return (this.direction == ScrollbarDirection.Left_To_Right || this.direction == ScrollbarDirection.Right_To_Left) ? Orientation.Horizontal : Orientation.Vertical
    }
    protected __preload() {
        this.transform.setAnchorPoint(0.5, 0.5)
        this.handleTransform.setAnchorPoint(0.5, 0.5)
        this.handle.node.setPosition(0, 0)
        if (this.adapter) {
            this.adapter.scrollManager.on(ScrollManager.Event.ON_UPDATE_SCROLLBAR, this.onUpdateScrollbar, this)
            this.updateVisuals()
        }


    }
    private onUpdateScrollbar(offset: number, position: number, percentage: number) {
        var size = 0
        var value = 0
        if (this.adapter.viewManager.virtualSize > 0) {
            var expand = this.adapter.scrollManager.maxExpand + this.adapter.scrollManager.minExpand
            size = Mathf.clamp01((this.adapter.viewMainSize - Math.abs(offset) - expand) / this.adapter.contentMainSize)
        }
        value = percentage
        if (this.adapter.viewManager.virtualSize <= this.adapter.viewMainSize) {
            value = value > 0 ? 1 : value
        }
        this.size = size
        this.value = value
    }
    private updateVisuals() {
        if (!this.handleTransform || !this.adapter) return
        var min = { x: 0, y: 0 }
        var max = { x: 0, y: 0 }
        var mainAxis = this.adapter.mainAxis
        var movement = Mathf.clamp01(this.value) * (1 - this.size)
        min[mainAxis.xy] = movement
        max[mainAxis.xy] = movement + this.size
        var header = this.transform[this.wh] - max[mainAxis.xy] * this.transform[this.wh]
        var footer = min[mainAxis.xy] * this.transform[this.wh]
        var pos = this.handle.node.getPosition()
        switch (this.direction) {
            case ScrollbarDirection.Bottom_To_Top:
            case ScrollbarDirection.Left_To_Right:
                pos[this.xy] = (footer - header) * 0.5
                break
            case ScrollbarDirection.Top_To_Bottom:
            case ScrollbarDirection.Right_To_Left:
                pos[this.xy] = (header - footer) * 0.5
                break
        }
        this.handleTransform[this.wh] = this.transform[this.wh] - header - footer
        this.handle.node.setPosition(pos)
    }
    protected update() {
        if (this._isDirty) {
            this._isDirty = false
            this.updateVisuals()
        }
    }


}

