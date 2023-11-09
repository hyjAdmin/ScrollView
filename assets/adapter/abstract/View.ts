const { ccclass, property } = cc._decorator;
import { Orientation } from "../enum/enum";
import { IFeature, IVec2Like, IViewElement, IViewFeature, IViewInfo } from "../interface/interface";
import { ScrollAdapter } from "../ScrollAdapter";
import { Holder } from "./Holder";
type TempType = Holder<any> | IFeature
export abstract class View<TModel = any> {
    protected abstract setViewElement(element: IViewElement, data: TModel): void
    protected abstract onVisible(): void
    protected abstract onDisable(): void
    private _adapter: ScrollAdapter<TModel>
    private _virtualSize: cc.Size = new cc.Size(0, 0)
    private _virtualPosition: cc.Vec2 = new cc.Vec2()
    private _holderList: Holder<TModel>[] = []
    private _holderOrFeatureList: TempType[] = []
    private _innerSize: number = 0
    private _holderTotal: number = 0
    private _info: IViewInfo
    get adapter() { return this._adapter }
    get total() { return this._holderTotal }
    get innerSize() { return this._innerSize }
    get viewIndex() { return this._info ? this._info.viewIndex : -1 }
    get virtualSize() { return this._virtualSize }
    get virtualPosition() { return this._virtualPosition }
    get holderList() { return this._holderList }
    get info() { return this._info }
    /** 垂直时 start = 上, 水平时 start = 左 向上永远是正数 向下永远是负数 ✅*/
    get headerBoundary() {
        return this.virtualPosition[this._adapter.mainAxis.xy] + this._adapter.scrollManager.mainContentPosition
    }
    /** 垂直时 end = 下, 水平时 end = 右  ✅*/
    get footerBoundary() {
        var value = this.virtualPosition[this._adapter.mainAxis.xy]
        value -= this._adapter.multiplier * this.mainAxisSize
        value += this._adapter.scrollManager.mainContentPosition
        return value
    }

    get mainAxisSize() {
        return this._virtualSize[this.adapter.mainAxis.wh]
    }
    get crossAxisSize() {
        return this._virtualSize[this.adapter.crossAxis.wh]
    }
    getPosition() {
        return { x: this.virtualPosition.x, y: this.virtualPosition.y }
    }
    constructor(adapter: ScrollAdapter<TModel>) {
        this._adapter = adapter
        this.reset()
    }

    private getCrossPreferredSize(element: IViewElement, feature: IFeature<TModel>) {
        var preferredSize = 0
        if (element.preferredSize[this._adapter.crossAxis.wh] > 0) {
            preferredSize = this.adapter.layoutManager.getPreferredSize(element, this.adapter.isHorizontal ? Orientation.Vertical : Orientation.Horizontal)
        } else {
            preferredSize = feature.size[this.adapter.crossAxis.wh]
        }
        // var size = Math.max(preferredSize, feature.size[this.adapter.crossAxis.wh])
        // console.log(preferredSize, size)
        return preferredSize
    }
    protected calculateFull(feature: IFeature<TModel>) {
        var element = this.adapter.viewManager["getNewViewElement"]()
        this.setViewElement(element, feature.data)
        var preferredSize = this.getCrossPreferredSize(element, feature)
        var innerSize = this._innerSize + this.adapter.layoutManager.spacing + preferredSize
        return innerSize >= this._virtualSize[this.adapter.crossAxis.wh]
    }
    private reset() {
        this._info = null
        this._innerSize = 0
        this._holderTotal = 0
        this._virtualSize[this.adapter.mainAxis.wh] = 0
        this._virtualSize[this.adapter.crossAxis.wh] = this.adapter.viewCrossSize
        this._holderList.length = 0
        this._holderOrFeatureList.length = 0
    }
    private calculateElement(feature: IFeature<TModel>) {
        this.setViewElement(feature.element, feature.data)
        feature.size[this.adapter.crossAxis.wh] = this.getCrossPreferredSize(feature.element, feature)
    }
    private calculateInnerSize(feature: IFeature<TModel>) {
        this._holderTotal++
        if (!feature.element.ignoreLayout) {
            var size = this._virtualSize[this.adapter.mainAxis.wh]
            if (this._innerSize != 0) {
                this._innerSize += this.adapter.layoutManager.spacing
            }
            this._innerSize += feature.size[this.adapter.crossAxis.wh]
            this._virtualSize[this.adapter.mainAxis.wh] = Math.max(size, feature.size[this.adapter.mainAxis.wh])
        }
    }
    calculateGridInnerSize(feature: IFeature<TModel>) {
        if (this.total == 0) return false
        var size = this.getCrossPreferredSize(feature.element, feature)
        return this.innerSize + size >= this.virtualSize[this.adapter.crossAxis.wh]
    }

    private resetVirtualSize(isUpdateViewToFooter: boolean) {
        this._virtualSize[this.adapter.mainAxis.wh] = 0
        for (let i = 0; i < this._holderList.length; i++) {
            const holder = this._holderList[i];
            if (!holder.feature) {
                return
            }
            this._virtualSize[this.adapter.mainAxis.wh] = Math.max(
                this._virtualSize[this.adapter.mainAxis.wh],
                holder.feature.size[this.adapter.mainAxis.wh]
                * holder.feature.scale[this.adapter.mainAxis.xy]
            )
        }
        if (this._info) {
            var oldMainAxisSize = this._info.size[this.adapter.mainAxis.wh]
            if (oldMainAxisSize != this._virtualSize[this.adapter.mainAxis.wh]) {
                // console.log(this.index, "需要更新info", this.viewHolderList[0].feature.data.message)
                this._info.size[this.adapter.mainAxis.wh] = this._virtualSize[this.adapter.mainAxis.wh]
                this.adapter.viewManager["viewSizeChange"](this, oldMainAxisSize, isUpdateViewToFooter)
            }
        }
    }
    /**
     * holder尺寸改变了 需要重新布局
     * @param mainSizeChanged 主轴尺寸是否改变了
     */
    holderChanged(mainSizeChanged: boolean) {
        if (mainSizeChanged) {
            this.resetVirtualSize(true)
        }
        this.layoutHolders(false)
    }
    /**
     * 布局当前view
     * @param force 马上更新
     */
    layoutHolders(force: boolean = false) {
        this.adapter.layoutManager.layout(this.info, () => this.virtualPosition, this.onLayoutFinish.bind(this), force)
    }
    protected onLayoutFinish() {
        for (let i = 0; i < this.holderList.length; i++) {
            const holder = this.holderList[i];
            holder["update"]()
        }
    }

    private pushHolder(holder: Holder<TModel>, feature: IFeature<TModel>, isNew: boolean) {
        this._holderList.push(holder)
        holder["visible"](feature, this.info, this)
        // if (isNew) {
        //     holder.visible()
        // }
    }
    private calculate(info: IViewInfo, getHolder: (feature: IFeature<TModel>) => Holder<TModel>) {
        this._info = info
        for (let i = 0; i < info.features.length; i++) {
            const feature = info.features[i];
            var holder = getHolder && getHolder(feature)
            if (holder) {
                this._holderOrFeatureList.push(holder)
            } else {
                this._holderOrFeatureList.push(feature)
            }
        }
    }
    private update(layout: boolean = true) {
        for (let i = 0; i < this._holderOrFeatureList.length; i++) {
            const holderOrFeature = this._holderOrFeatureList[i];
            if (holderOrFeature instanceof Holder) {
                this.pushHolder(holderOrFeature, holderOrFeature.feature, false)
            } else {
                var prefab = this.adapter.viewManager["getPrefab"](holderOrFeature.data)
                let holder = this.adapter.viewManager["getHolderFromDisableHolderList"](holderOrFeature, prefab)
                this.pushHolder(holder, holderOrFeature, true)
            }
        }
        this.resetVirtualSize(false)
        if (layout) {
            this.layoutHolders(false)
        }
        this.onVisible()
    }
    private disable() {
        this.onDisable()
        this.reset()
    }
    getFixedHolders() {
        if (!this.info.fixed) return []
        var list = []
        for (let i = 0; i < this.holderList.length; i++) {
            const holder = this.holderList[i];
            if (holder.feature.element.fixed) {
                list.push(holder)
            }
        }
        return list
    }
    private clampPosition(relative: View, direction: number = null) {
        var position = { x: 0, y: 0 }
        var xy = this.adapter.mainAxis.xy
        var multiplier = this.adapter.multiplier
        var spacing = this.adapter.viewManager.spacing
        if (!relative) {
            // console.log("更新我的坐标", "起始位置")
            this.getMainPositionStart(position)
        } else {
            if (direction == null) {
                direction = this.viewIndex - relative.viewIndex
            }
            direction = direction > 0 ? 1 : -1
            // console.error(this.viewHolderList[0].feature.data.name, "方向", direction)
            var relativePoint, myPoint
            if (direction > 0) {
                relativePoint = multiplier == 1 ? relative.info.point[xy] : 1 - relative.info.point[xy]
                myPoint = multiplier == 1 ? 1 - this.info.point[xy] : this.info.point[xy]
            } else {
                relativePoint = multiplier == 1 ? 1 - relative.info.point[xy] : relative.info.point[xy]
                myPoint = multiplier == 1 ? this.info.point[xy] : 1 - this.info.point[xy]
            }
            position[xy] = relative.virtualPosition[xy]
            position[xy] -= (relative.mainAxisSize * relativePoint * direction) * multiplier
            position[xy] -= spacing * multiplier * direction
            position[xy] -= (this.mainAxisSize * myPoint * direction) * multiplier
        }
        this.setPosition(position)
    }
    private updateMainPosition(mainPosition: number): void {
        var position = { x: 0, y: 0 }
        position[this._adapter.mainAxis.xy] = mainPosition
        this.setPosition(position)
    }
    protected setPosition(position: IVec2Like) {
        this._virtualPosition.x = position.x
        this._virtualPosition.y = position.y
        this.layoutHolders(true)
    }
    protected getMainPositionStart(out: IVec2Like) {
        var paddingOffset = 0
        if (this._adapter.isHorizontal) {
            paddingOffset = this._adapter.isArrangeStart ? this._adapter.viewManager.left : -this._adapter.viewManager.right
        } else {
            paddingOffset = this._adapter.isArrangeStart ? -this._adapter.viewManager.top : this._adapter.viewManager.bottom
        }
        out[this._adapter.mainAxis.xy] = paddingOffset
    }
}