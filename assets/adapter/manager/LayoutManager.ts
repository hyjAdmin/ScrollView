const { ccclass, property } = cc._decorator;
import { Manager } from '../abstract/Manager';
import { ChildAlignment, Orientation } from '../enum/enum';
import { Helper } from '../helper/Helper';
import { Mathf } from '../helper/Mathf';
import { IFeature, IVec2Like, IViewElement, IViewFeature, IViewInfo } from '../interface/interface';
import { ViewManager } from './ViewManager';
enum Event {
    ON_LAYOUT_PARAMS_CHANGED
}
@ccclass("LayoutManager")
export class LayoutManager extends Manager<Event> {
    static Event = Event
    @property({ type: cc.Enum(ChildAlignment) }) private _childAlignment: ChildAlignment = ChildAlignment.UpperLeft
    @property({ type: cc.Enum(ChildAlignment) }) get childAlignment() { return this._childAlignment }
    set childAlignment(value: ChildAlignment) {
        if (value == this._childAlignment) return
        this._childAlignment = value
        this.emit(Event.ON_LAYOUT_PARAMS_CHANGED)
    }
    @property() spacing: number = 0
    @property() private _reverseArrangement: boolean = false
    @property() get reverseArrangement() { return this._reverseArrangement }
    set reverseArrangement(value: boolean) {
        if (value == this._reverseArrangement) return
        this._reverseArrangement = value
        this.emit(Event.ON_LAYOUT_PARAMS_CHANGED)
    }
    @property() childScaleWidth: boolean = false
    @property() childScaleHeight: boolean = false
    @property() childControlWidth: boolean = false
    @property() childControlHeight: boolean = false
    @property() childForceExpandWidth: boolean = true
    @property() childForceExpandHeight: boolean = true
    get top() {
        if (this.adapter.isVertical) return 0
        return this.adapter.viewManager.top
    }
    get bottom() {
        if (this.adapter.isVertical) return 0
        return this.adapter.viewManager.bottom
    }
    get left() {
        if (this.adapter.isHorizontal) return 0
        return this.adapter.viewManager.left
    }
    get right() {
        if (this.adapter.isHorizontal) return 0
        return this.adapter.viewManager.right
    }
    get horizontal() { return this.left + this.right }
    get vertical() { return this.top + this.bottom }
    private _layoutList: {
        info: IViewInfo,
        getVirtualPosition: () => IVec2Like,
        onFinish: () => void
    }[] = []
    private _isDirty: boolean = false
    layout(info: IViewInfo, getVirtualPosition: () => IVec2Like, onFinish: () => void, force: boolean = false): void {
        var index = this._layoutList.findIndex(item => item.info.viewIndex == info.viewIndex)
        if (-1 != index) {
            this._layoutList.splice(index, 1)[0]
        }
        if (force) {
            this.layoutHandler(info, getVirtualPosition, onFinish)
            return
        }
        this._layoutList.push({
            info: info,
            getVirtualPosition: getVirtualPosition,
            onFinish: onFinish
        })
        this._isDirty = true
    }
    protected onInit(): void {
        this.adapter.viewManager.on(ViewManager.Event.ON_RESET_VIEW, this.onArrangeAxisChanged, this)
    }
    private getLayoutList(features: IFeature[]) {
        var list = []
        for (let i = 0; i < features.length; i++) {
            const feature = features[i];
            if (feature.element.ignoreLayout) continue
            list.push(feature)
        }
        return list
    }
    private onArrangeAxisChanged() {
        this._isDirty = false
        this._layoutList.length = 0
    }
    getMinSize(element: IViewElement, axis: Orientation) {
        return element.minSize[Helper.wh(axis)]
    }
    getPreferredSize(element: IViewElement, axis: Orientation) {
        return Math.max(element.minSize[Helper.wh(axis)], element.preferredSize[Helper.wh(axis)])
    }
    getFlexibleSize(element: IViewElement, axis: Orientation) {
        return element.flexibleSize[Helper.wh(axis)]
    }
    getTotalMinSize(info: IViewInfo, axis: Orientation): number {
        return info.totalMinSize[Helper.wh(axis)]
    }
    getTotalPreferredSize(info: IViewInfo, axis: Orientation): number {
        return info.totalPreferredSize[Helper.wh(axis)]
    }
    getTotalFlexibleSize(info: IViewInfo, axis: Orientation): number {
        return info.totalFlexibleSize[Helper.wh(axis)]
    }
    getChildSizes(feature: IFeature, axis: Orientation, controlSize: boolean, childForceExpand: boolean) {
        var min, preferred, flexible
        if (!controlSize) {
            min = feature.size[Helper.wh(axis)]
            preferred = min
            flexible = 0
        }
        else {
            min = this.getMinSize(feature.element, axis)
            preferred = this.getPreferredSize(feature.element, axis)
            flexible = this.getFlexibleSize(feature.element, axis)
        }
        if (childForceExpand) {
            flexible = Math.max(flexible, 1)
        }
        return { min, preferred, flexible }
    }
    private getAlignmentOnAxis(axis: Orientation) {
        if (axis == Orientation.Horizontal) {
            return (this.adapter.layoutManager.childAlignment % 3) * 0.5
        } else {
            return Math.floor(this.adapter.layoutManager.childAlignment / 3) * 0.5
        }
    }
    private setChildAlongAxisWithScale(getVirtualPosition: () => IVec2Like, info: IViewInfo, feature: IFeature, axis: Orientation, pos: number, scaleFactor: number, size?: number) {
        if (feature == null)
            return
        const keyWH = Helper.wh(axis)
        const keyXY = Helper.xy(axis)
        if (!isNaN(size)) {
            feature.size[keyWH] = size
        }
        var position = { x: feature.position.x, y: feature.position.y }
        var value = 0
        if (axis == Orientation.Horizontal) {
            value = pos + feature.size[keyWH] * feature.point[keyXY] * scaleFactor
            value -= info.size[keyWH] * info.point[keyXY]
            value += getVirtualPosition()[keyXY]
        } else {
            value = -pos - feature.size[keyWH] * (1 - feature.point[keyXY]) * scaleFactor
            value += info.size[keyWH] * (1 - info.point[keyXY])
            value += getVirtualPosition()[keyXY]
        }
        position[keyXY] = value
        feature.position = position
    }
    private calcAlongAxis(info: IViewInfo, axis: Orientation, isVertical: boolean): void {
        var combinedPadding = (axis == Orientation.Horizontal ? this.horizontal : this.vertical)
        var controlSize = (axis == Orientation.Horizontal ? this.childControlWidth : this.childControlHeight)
        var useScale = (axis == Orientation.Horizontal ? this.childScaleWidth : this.childScaleHeight)
        var childForceExpandSize = (axis == Orientation.Horizontal ? this.childForceExpandWidth : this.childForceExpandHeight)
        var totalMin = combinedPadding
        var totalPreferred = combinedPadding
        var totalFlexible = 0
        var alongOtherAxis = isVertical != (axis == Orientation.Vertical)
        // var activeChildrenLength = info.features.length
        var layoutList = this.getLayoutList(info.features)
        for (let i = 0; i < layoutList.length; i++) {
            var feature = layoutList[i]
            if (feature.element.ignoreLayout) {
                continue
            }
            var { min, preferred, flexible } = this.getChildSizes(feature, axis, controlSize, childForceExpandSize)
            if (useScale) {
                var scaleFactor = feature.scale[Helper.xy(axis)]
                min *= scaleFactor
                preferred *= scaleFactor
                flexible *= scaleFactor
            }
            if (alongOtherAxis) {
                totalMin = Math.max(min + combinedPadding, totalMin)
                totalPreferred = Math.max(preferred + combinedPadding, totalPreferred)
                totalFlexible = Math.max(flexible, totalFlexible)
            } else {
                totalMin += min + this.spacing
                totalPreferred += preferred + this.spacing
                totalFlexible += flexible
            }
        }
        if (!alongOtherAxis && layoutList.length > 0) {
            totalMin -= this.spacing
            totalPreferred -= this.spacing
        }
        totalPreferred = Math.max(totalMin, totalPreferred)
        this.setLayoutInputForAxis(info, totalMin, totalPreferred, totalFlexible, axis)
    }
    private setLayoutInputForAxis(info: IViewInfo, totalMin: number, totalPreferred: number, totalFlexible: number, axis: Orientation) {
        var key = Helper.wh(axis)
        info.totalMinSize[key] = totalMin
        info.totalPreferredSize[key] = totalPreferred
        info.totalFlexibleSize[key] = totalFlexible
    }

    private setChildrenAlongAxis(getVirtualPosition: () => IVec2Like, info: IViewInfo, axis: Orientation, isVertical: boolean): void {
        var size = info.size[Helper.wh(axis)]
        var controlSize = (axis == Orientation.Horizontal ? this.childControlWidth : this.childControlHeight)
        var useScale = (axis == Orientation.Horizontal ? this.childScaleWidth : this.childScaleHeight)
        var childForceExpandSize = (axis == Orientation.Horizontal ? this.childForceExpandWidth : this.childForceExpandHeight)
        var alignmentOnAxis = this.getAlignmentOnAxis(axis)

        var layoutList = this.getLayoutList(info.features)
        var alongOtherAxis = isVertical != (axis == Orientation.Vertical)
        var startIndex = this.reverseArrangement ? layoutList.length - 1 : 0
        var endIndex = this.reverseArrangement ? 0 : layoutList.length
        var increment = this.reverseArrangement ? -1 : 1
        if (alongOtherAxis) {
            var innerSize = size - (axis == Orientation.Horizontal ? this.horizontal : this.vertical)
            for (var i = startIndex; this.reverseArrangement ? i >= endIndex : i < endIndex; i += increment) {
                const feature = layoutList[i]
                var { min, preferred, flexible } = this.getChildSizes(feature, axis, controlSize, childForceExpandSize)
                let scaleFactor = useScale ? feature.scale[Helper.xy(axis)] : 1
                var requiredSpace = Mathf.clamp(innerSize, min, flexible > 0 ? size : preferred)
                var startOffset = this.getStartOffset(info, axis, requiredSpace * scaleFactor)
                if (controlSize) {
                    this.setChildAlongAxisWithScale(getVirtualPosition, info, feature, axis, startOffset, scaleFactor, requiredSpace)
                } else {
                    var offsetInCell = (requiredSpace - feature.size[Helper.wh(axis)]) * alignmentOnAxis
                    offsetInCell *= scaleFactor
                    this.setChildAlongAxisWithScale(getVirtualPosition, info, feature, axis, startOffset + offsetInCell, scaleFactor)
                }
            }
        } else {
            var pos = (axis == Orientation.Horizontal ? this.left : this.top)
            var itemFlexibleMultiplier = 0
            var surplusSpace = size - this.getTotalPreferredSize(info, axis)
            if (surplusSpace > 0) {
                if (this.getTotalFlexibleSize(info, axis) == 0) {
                    pos = this.getStartOffset(info, axis, this.getTotalPreferredSize(info, axis) - (axis == Orientation.Horizontal ? this.horizontal : this.vertical))
                }
                else if (this.getTotalFlexibleSize(info, axis) > 0) {
                    itemFlexibleMultiplier = surplusSpace / this.getTotalFlexibleSize(info, axis)
                }
            }
            var minMaxLerp = 0
            if (this.getTotalMinSize(info, axis) != this.getTotalPreferredSize(info, axis)) {
                minMaxLerp = Mathf.clamp01((size - this.getTotalMinSize(info, axis)) / (this.getTotalPreferredSize(info, axis) - this.getTotalMinSize(info, axis)))
            }

            for (var i = startIndex; this.reverseArrangement ? i >= endIndex : i < endIndex; i += increment) {
                var feature = layoutList[i]
                var { min, preferred, flexible } = this.getChildSizes(feature, axis, controlSize, childForceExpandSize)
                let scaleFactor = useScale ? feature.scale[Helper.xy(axis)] : 1
                var childSize = Mathf.lerp(min, preferred, minMaxLerp)
                childSize += flexible * itemFlexibleMultiplier
                if (controlSize) {
                    this.setChildAlongAxisWithScale(getVirtualPosition, info, feature, axis, pos, scaleFactor, childSize)
                }
                else {
                    var offsetInCell = (childSize - feature.size[Helper.wh(axis)]) * alignmentOnAxis
                    this.setChildAlongAxisWithScale(getVirtualPosition, info, feature, axis, pos + offsetInCell, scaleFactor)
                }
                pos += childSize * scaleFactor + this.spacing
            }
        }
    }
    protected getStartOffset(info: IViewInfo, axis: Orientation, requiredSpaceWithoutPadding: number): number {
        var requiredSpace = requiredSpaceWithoutPadding + (axis == Orientation.Horizontal ? this.horizontal : this.vertical)
        var availableSpace = info.size[Helper.wh(axis)]
        var surplusSpace = availableSpace - requiredSpace
        var alignmentOnAxis = this.getAlignmentOnAxis(axis)
        return (axis == Orientation.Horizontal ? this.left : this.top) + surplusSpace * alignmentOnAxis
    }
    protected lateUpdate(deltaTime: number) {
        if (this._isDirty) {
            this._isDirty = false
            while (this._layoutList.length > 0) {
                var item = this._layoutList.pop()
                this.layoutHandler(item.info, item.getVirtualPosition, item.onFinish)
            }
        }
    }
    private layoutHandler(info: IViewInfo, getVirtualPosition: () => IVec2Like, onFinish: () => void) {
        this.calcAlongAxis(info, Orientation.Horizontal, this.adapter.isHorizontal)
        this.setChildrenAlongAxis(getVirtualPosition, info, Orientation.Horizontal, this.adapter.isHorizontal)
        this.calcAlongAxis(info, Orientation.Vertical, this.adapter.isHorizontal)
        this.setChildrenAlongAxis(getVirtualPosition, info, Orientation.Vertical, this.adapter.isHorizontal)
        onFinish()
    }


}

