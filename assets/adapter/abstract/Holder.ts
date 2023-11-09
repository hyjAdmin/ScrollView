const { ccclass, property } = cc._decorator;
import { Helper } from "../helper/Helper"
import { IFeature, IViewInfo } from "../interface/interface"
import { LayoutManager } from "../manager/LayoutManager"
import { ModelManager } from "../manager/ModelManager"
import { ScrollManager } from "../manager/ScrollManager"
import { ScrollAdapter } from "../ScrollAdapter"
import { View } from "./View"
export abstract class Holder<TModel = any> {
    protected abstract onCreated(): void
    protected abstract onVisible(): void
    protected abstract onDisable(): void
    protected onScroll(): void { }
    private _code: string
    private _info: IViewInfo
    private _node: cc.Node
    private _transform: cc.Node
    private _feature: IFeature<TModel>
    private _virtialPosition: number = 0
    get info() { return this._info }
    get node() { return this._node }
    get transform() { return this._transform }
    get code() { return this._code }
    get feature() { return this._feature }
    get element() { return this.feature.element }
    get data() { return this.feature.data }
    private _adapter: ScrollAdapter
    get adapter() { return this._adapter }
    private _view: View<TModel>
    get view() { return this._view }
    private _featureIndex: number = -1
    get featureIndex() { return this._featureIndex }
    private _isInited: boolean = false
    constructor(node: cc.Node, code: string, adapter: ScrollAdapter<TModel>) {
        this._node = node
        this._adapter = adapter
        this._transform = node
        if (!this._transform) {
            throw Error("找不到UITransform")
        }
        this._code = code
        this.adapter.modelManager.on(ModelManager.Event.ON_REFRESH, this.onRefreshModel, this)
    }
    private onRefreshModel() {
        if (!this.feature) return
        this.onVisible()
    }
    private onSizeChanged() {
        var mainWH = this._adapter.mainAxis.wh
        var crossWH = this._adapter.crossAxis.wh
        var equalMain = this.transform[mainWH] == this.feature.size[mainWH]
        var equalCross = this.transform[crossWH] == this.feature.size[crossWH]
        if (equalMain && equalCross) {
            // console.warn(this.feature.index, "尺寸相同 无需通知", this.transform[mainWH], this.feature.size.width, this.feature.size.height)
            return
        }
        var mainSizeChanged = this.transform[mainWH] != this.feature.size[mainWH]
        this.feature.size.width = this.transform.width
        this.feature.size.height = this.transform.height
        this.rebuild(mainSizeChanged)
    }
    private onTransformChanged(type) {
        if (!this.feature) return
        // if (type & cc.Node.TransformBit.SCALE) {
        if (this.feature.scale.x == this.node.scaleX && this.feature.scale.y == this.node.scaleY) {
            return
        }
        var mainSizeChanged = this.node.scale[this.adapter.mainAxis.xy] != this.feature.scale[this.adapter.mainAxis.xy]
        this.feature.scale = { x: this.node.scaleX, y: this.node.scaleY }
        this.rebuild(mainSizeChanged)
        // }
    }
    private onAnchorChanged() {
        if (!this.feature) return
        if (this.feature.point.x == this.transform.anchorX && this.feature.point.y == this.transform.anchorY) {
            return
        }
        this.feature.point = { x: this.transform.anchorX, y: this.transform.anchorY }
        this.rebuild(false)
    }
    private rebuild(mainSizeChanged: boolean) {
        if (this.view) {
            this.view.holderChanged(mainSizeChanged)
        } else {
            if (this.feature.element.ignoreLayout) {
                return
            }
            this.adapter.viewManager.layoutFixedHolders(this.info, this._virtialPosition)
        }
    }
    private register() {
        if (this.element.fixed) {
            this.adapter.layoutManager.on(LayoutManager.Event.ON_LAYOUT_PARAMS_CHANGED, this.onLayoutParamsChanged, this)
        }
        this._adapter.scrollManager.on(ScrollManager.Event.ON_SCROLL, this.scrollHandler, this)
        this._node.on(cc.Node.EventType.SIZE_CHANGED, this.onSizeChanged, this)
        this._node.on(cc.Node.EventType.SCALE_CHANGED, this.onTransformChanged, this)
        this._node.on(cc.Node.EventType.ANCHOR_CHANGED, this.onAnchorChanged, this)
    }
    private unregister() {
        this.adapter.layoutManager.off(LayoutManager.Event.ON_LAYOUT_PARAMS_CHANGED, this.onLayoutParamsChanged, this)
        this._adapter.scrollManager.off(ScrollManager.Event.ON_SCROLL, this.scrollHandler, this)
        this._node.off(cc.Node.EventType.SIZE_CHANGED, this.onSizeChanged, this)
        this._node.off(cc.Node.EventType.SCALE_CHANGED, this.onTransformChanged, this)
        this._node.off(cc.Node.EventType.ANCHOR_CHANGED, this.onAnchorChanged, this)
    }
    private holderSyncToFeature() {
        this.feature.size.width = this.transform.width
        this.feature.size.height = this.transform.height
        this.feature.point.x = this.transform.anchorX
        this.feature.point.y = this.transform.anchorY
        this.feature.scale.x = this.node.scaleX
        this.feature.scale.y = this.node.scaleY
    }
    private featureSyncToHolder() {
        this.transform.setContentSize(this.feature.size.width, this.feature.size.height)
        this.transform.setAnchorPoint(this.feature.point.x, this.feature.point.y)
        this.node.setScale(this.feature.scale.x, this.feature.scale.y)
    }
    private setVirtialPosition(position: number) {
        this._virtialPosition = position
    }
    private update() {
        if (this.feature.element.ignoreLayout) {
            return
        }
        this.transform.setContentSize(this.feature.size.width, this.feature.size.height)
        this.node.setPosition(this.feature.position.x, this.feature.position.y)
        if (this.element.fixed) {
            this.calculateFixed()
        }
    }
    private visible(feature: IFeature<TModel>, info: IViewInfo, view: View<TModel>) {
        var call = false
        if (!this._feature || !this._info || !this._view) {
            call = true
        } else if (!this._view || this._view.viewIndex != view.viewIndex) {
            call = true
        }
        this._feature = feature
        this._view = view
        this._info = info
        if (!this._isInited) {
            this._isInited = true
            this.onCreated()
        }
        if (call) {
            this.callOnVisible()
        }
        return this
    }
    private disable() {
        this.onDisable()
        this.unregister()
        this.node.active = false
        this._feature = null
        this._view = null
        this._featureIndex = -1
    }
    get headerBoundary() {
        return this.feature.position[this.adapter.mainAxis.xy]
            + this.feature.size[this.adapter.mainAxis.wh]
            * (1 - this.feature.point[this.adapter.mainAxis.xy])
            * this.feature.scale[this.adapter.mainAxis.xy]
            + this.adapter.scrollManager.mainContentPosition
    }
    get footerBoundary() {
        return this.feature.position[this.adapter.mainAxis.xy]
            - this.feature.size[this.adapter.mainAxis.wh]
            * this.feature.point[this.adapter.mainAxis.xy]
            * this.feature.scale[this.adapter.mainAxis.xy]
            + this.adapter.scrollManager.mainContentPosition
    }
    private callOnVisible() {
        if (this.element.fixed) {
            this._featureIndex = this.info.features.findIndex(item => item.index == this.feature.index)
        }
        this.node.active = true
        this.featureSyncToHolder()
        this.onVisible()
        this.holderSyncToFeature()
        this.register()
    }
    private scrollHandler() {
        this.onScroll()
        if (!this.feature || !this.element.fixed) return
        this.calculateFixed()
    }
    private getBoundary() {
        var fixedOffset = Helper.isNumber(this.element.fixedOffset) ? this.element.fixedOffset : 0
        return this.adapter.multiplier == 1 ? this.headerBoundary + fixedOffset : this.footerBoundary - fixedOffset
    }
    private isNeedFixed(boundary: number) {
        return this.adapter.multiplier == 1 ? boundary >= 0 : boundary <= 0
    }
    private getRelativeBoundary(holder: Holder, offset: number) {
        var boundary = this.adapter.multiplier == 1 ? holder.headerBoundary : holder.footerBoundary
        var value = this.adapter.multiplier == 1 ? boundary + offset : offset - boundary
        return Math.min(value, offset)
    }
    private getSizeWithSpacing() {
        var fixedOffset = Helper.isNumber(this.element.fixedOffset) ? this.element.fixedOffset : 0
        var spacing = Helper.isNumber(this.element.fixedSpacing) ? this.element.fixedSpacing : this.adapter.viewManager.spacing
        return this.feature.size[this.adapter.mainAxis.wh] * this.feature.scale[this.adapter.mainAxis.xy] + fixedOffset + spacing
    }
    private calculateFixed() {
        var position = { x: this.feature.position.x, y: this.feature.position.y }
        var relativeOffset = 0
        var boundary = this.getBoundary()
        if (this.isNeedFixed(boundary)) {
            position[this.adapter.mainAxis.xy] -= boundary
            var holders = this.adapter.viewManager.getNextFixedHolders(this.info.viewIndex)
            var sizeSpacing = this.getSizeWithSpacing()
            for (let i = 0; i < holders.length; i++) {
                const holder = holders[i];
                var offset = this.getRelativeBoundary(holder, sizeSpacing)
                var sameScale = this.feature.scale[this.adapter.crossAxis.xy] == holder.feature.scale[this.adapter.crossAxis.xy]
                var sameSize = this.feature.size[this.adapter.crossAxis.wh] == holder.feature.size[this.adapter.crossAxis.wh]
                if (this.featureIndex == holder.featureIndex && sameScale && sameSize) {
                    relativeOffset = offset > 0 ? offset : 0
                    break
                }
                if (offset > 0) {
                    relativeOffset = Math.max(relativeOffset, offset)
                }
            }
        }
        position[this.adapter.mainAxis.xy] += relativeOffset * this.adapter.multiplier
        if (position[this.adapter.mainAxis.xy] != this.node.position[this.adapter.mainAxis.xy]) {
            this.node.setPosition(position.x, position.y)
        }
    }
    private onLayoutParamsChanged() {
        this.rebuild(false)
    }
}