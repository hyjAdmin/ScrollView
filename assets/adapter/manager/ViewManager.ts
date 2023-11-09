const { ccclass, property } = cc._decorator;
import { Manager } from '../abstract/Manager';
import { Holder } from '../abstract/Holder';
import { View } from '../abstract/View';
import { IFeature, IViewElement, IViewInfo } from '../interface/interface';
import { LayoutManager } from './LayoutManager';
import { ModelManager } from './ModelManager';
import { ScrollManager } from './ScrollManager';
import { Mathf } from '../helper/Mathf';
import { ArrangeAxis, Layer, MagneticDirection, ScrollDirection, WrapMode } from '../enum/enum';
const DISABLE_OUT_OFFSET = 10
enum Event {
    /** 
     * 可视区域的被更新
     */
    ON_UPDATE_VIEWS,
    /**
     * 虚拟尺寸改变
     */
    ON_VIRTUAL_SIZE_CHANGED,
    /**
     * 触发磁性停靠时
     */
    ON_MAGNETIC,
    /**
     * 需要重置可视区域时
     */
    ON_RESET_VIEW,
}
@ccclass("ViewManager")
export class ViewManager<TModelType = any> extends Manager<Event> {
    static Event = Event
    @property({ type: cc.Enum(ArrangeAxis) }) _arrangeAxis: ArrangeAxis = ArrangeAxis.Start
    @property({ type: cc.Enum(ArrangeAxis) }) get arrangeAxis() { return this._arrangeAxis }
    set arrangeAxis(value: ArrangeAxis) {
        if (value == this._arrangeAxis) return
        this._arrangeAxis = value
        this.onResetView()
    }
    @property() magnetic: boolean = false
    @property({
        type: cc.Enum(MagneticDirection),
        visible: function () { return this.magnetic }
    }) magneticDirection: MagneticDirection = MagneticDirection.Header
    @property({
        visible: function () { return this.magnetic }
    }) magneticDuration: number = 0.5

    @property({
        range: [0, 1],
        slide: true,
        step: 0.01,
        visible: function () { return this.magnetic }
    }) magneticStrength: number = 0.2
    @property() left: number = 0
    @property() right: number = 0
    @property() top: number = 0
    @property() bottom: number = 0
    @property() spacing: number = 0
    @property() private _loopHeader: boolean = false
    @property() get loopHeader() { return this._loopHeader }
    set loopHeader(value: boolean) {
        if (value == this._loopHeader) return
        if (this.adapter && this.adapter.pullReleaseManager.enable && value) {
            return
        }
        this._loopHeader = value
        this.adapter && this.adapter.scrollManager["updateScrollbar"](0)
    }
    @property() private _loopFooter: boolean = false
    @property() get loopFooter() { return this._loopFooter }
    set loopFooter(value: boolean) {
        if (value == this._loopFooter) return
        if (this.adapter && this.adapter.pullReleaseManager.enable && value) {
            return
        }
        this._loopFooter = value
        this.adapter && this.adapter.scrollManager["updateScrollbar"](0)
    }
    /**
     * 磁性停靠的偏移量，当数据为空时，返回可视区域尺寸，当有数据是 返回页脚的偏移量
     */
    get magneticOffset() {
        if (!this.magnetic) {
            return 0
        }
        var direction = this.adapter.isHorizontal ? -this.adapter.multiplier : this.adapter.multiplier
        if (this.magneticDirection == MagneticDirection.Footer) {
            if (!this.footer) {
                return this.adapter.viewMainSize * direction
            }
            return Math.max(0, this.adapter.viewMainSize - this.adapter.mainAxisPadding - this.visibleSize) * direction
        }
        return 0
    }
    get header() { return this._visibleList[0] }
    get footer() { return this._visibleList[this._visibleList.length - 1] }
    /** 
     * 可见列表真实的主轴尺寸
     */
    get visibleSize() {
        if (this._visibleList.length == 0) {
            return 0
        }
        var total = 0
        for (let i = 0; i < this._visibleList.length; i++) {
            const view = this._visibleList[i];
            total += view.info.size[this.adapter.mainAxis.wh] + this.spacing
        }
        total -= this.spacing
        return total
    }
    private _visibleList: View<TModelType>[] = []
    private _disableList: View<TModelType>[] = []
    private _disableHolderList: Holder<TModelType>[] = []
    private _fixedHolderList: Holder<TModelType>[] = []
    private _viewList: IViewInfo[] = []
    private _fixedList: number[] = []
    private _virtualSize: number = 0
    private _offsetHeader: number = 0
    private _forceToFooter = false
    private _prevPercentage: number
    private _prevVirtualSize: number
    get offsetHeader() { return this._offsetHeader }
    /** 当前可见列表长度 */
    get visibleLength() { return this._visibleList.length }
    /** 当前所有View长度 */
    get viewLength() { return this._viewList.length }
    /** 主轴的虚拟尺寸 */
    get virtualSize() { return this._virtualSize }
    get min() {
        if (!this.footer) return 0
        return this.adapter.isArrangeStart ? this.footer.footerBoundary : this.header.headerBoundary
    }
    get max() {
        if (!this.header) return 0
        return this.adapter.isArrangeStart ? this.header.headerBoundary : this.footer.footerBoundary
    }
    /** 重置当前可见列表 */
    resetViews() {
        this.onResetView()
    }
    /**
     * 布局所有固定的Holder
     * @param info 
     * @param position 
     * @param force 强制更新
     */
    layoutFixedHolders(info: IViewInfo, position: number, force: boolean = false) {
        if (this._fixedHolderList.length == 0) return console.warn("没有fixed")
        this.adapter.layoutManager.layout(info, () => {
            var virtualPosition = { x: 0, y: 0 }
            virtualPosition[this.adapter.mainAxis.xy] = position
            return virtualPosition
        }, () => {
            for (let i = 0; i < this._fixedHolderList.length; i++) {
                const holder = this._fixedHolderList[i];
                if (holder.info.viewIndex != info.viewIndex) continue
                holder["setVirtialPosition"](position)
                holder["update"]()
            }
        }, force)
    }
    /**
     * 获取给定view索引的下一个设置了fixed的Holder列表
     * @param viewIndex 
     */
    getNextFixedHolders(viewIndex: number) {
        var list = []
        for (let i = 0; i < this._visibleList.length; i++) {
            const view = this._visibleList[i];
            if (view.viewIndex == viewIndex) continue
            if (view.info.fixed) {
                list = view.getFixedHolders()
                break
            }
        }
        return list
    }
    /**
     * 获取可见View
     * @param viewIndex 
     */
    getVisibleViewByIndex(viewIndex: number) {
        return this._visibleList[viewIndex]
    }
    /**
     * 判断给定的View索引是否在可见列表中
     * @param viewIndex （非数据索引）
     */
    isVisibleByViewIndex(viewIndex: number) {
        return !!this.getVisibleViewByViewIndex(viewIndex)
    }
    /**
     * 通过infoIndex获取可视列表中的view
     */
    getVisibleViewByViewIndex(viewIndex: number) {
        return this._visibleList.find(view => view.viewIndex == viewIndex)
    }
    /**
     * 通过用户数据索引查找可视列表索引
     */
    findVisibleIndexByModelIndex(modelIndex: number): number {
        var viewIndex = this._visibleList.findIndex(view => {
            return !!view.holderList.find(holder => holder.feature.index == modelIndex)
        })
        return viewIndex
    }
    /**
     * 通过view索引查找可视列表索引
     * @param viewIndex 
     */
    findVisibleIndexByViewIndex(viewIndex: number) {
        return this._visibleList.findIndex(view => view.viewIndex == viewIndex)
    }
    /**
     * 通过viewInfo索引获取viewInfo
     */
    getViewByViewIndex(infoIndex: number) {
        return this._viewList[infoIndex]
    }
    /**
     * 通过数据索引查找viewInfo索引
     */
    findViewIndexByModelIndex(modelIndex: number): number {
        var index = 0
        for (let i = 0; i < this._viewList.length; i++) {
            const info = this._viewList[i];
            index += info.features.length
            if (index >= modelIndex) {
                return info.viewIndex
            }
        }
        return -1
    }


    protected onInit(): void {
        if (this.adapter.pullReleaseManager.enable) {
            this._loopHeader = false
            this._loopFooter = false
        }
        this.adapter.modelManager.on(ModelManager.Event.ON_INSERT, this.refreshViews, this)
        this.adapter.modelManager.on(ModelManager.Event.ON_REMOVE, this.refreshViews, this)
        this.adapter.modelManager.on(ModelManager.Event.ON_MOVE, this.refreshViews, this)
        this.adapter.modelManager.on(ModelManager.Event.ON_CLEAR, this.onClearModel, this)
        this.adapter.scrollManager.on(ScrollManager.Event.ON_SCROLL, this.onScroll, this)
        this.adapter.scrollManager.on(ScrollManager.Event.ON_ORIENTATION_CHANGED, this.onResetView, this)
        this.adapter.scrollManager.on(ScrollManager.Event.ON_VIEW_SIZE_CHANGED, this.onResetView, this)
        this.adapter.layoutManager.on(LayoutManager.Event.ON_LAYOUT_PARAMS_CHANGED, this.onLayoutParamsChanged, this)
    }
    private restoreToOriginalState() {
        this._offsetHeader = 0
        this._forceToFooter = false
        this._prevPercentage = 0
        this._prevVirtualSize = 0
        this._viewList.length = 0
        this._fixedList.length = 0
        for (let i = 0; i < this._visibleList.length; i++) {
            this.recycleView(this._visibleList[i])
        }
        this._visibleList.length = 0
        for (let i = 0; i < this._fixedHolderList.length; i++) {
            const holder = this._fixedHolderList[i];
            this.recycleHolder(holder)
        }
        this._fixedHolderList.length = 0
        this.updateVirtualSize()
    }
    private onClearModel() {
        this.restoreToOriginalState()
        this.emit(Event.ON_UPDATE_VIEWS)
    }
    private onResetView() {
        this.restoreToOriginalState()
        this.emit(Event.ON_RESET_VIEW)
        this.refreshViews(0)
    }
    private refreshViews(index: number) {
        this._prevPercentage = this.adapter.scrollManager.percentage
        this._prevVirtualSize = this.virtualSize
        // this.adapter.unschedule(this.delayResetForceToFooter.bind(this))
        this._forceToFooter = true
        this.resetViewInfoList(index)
        this.resetVisibleList()
        this.updateVirtualSize()
        this.calculateOffsetHeader()
        this.emit(Event.ON_UPDATE_VIEWS)
        // this.adapter.scheduleOnce(this.delayResetForceToFooter.bind(this))
        this.magneticHandler()
    }
    private magneticHandler() {
        if (!this.magnetic) return
        this.adapter.scrollManager["setTouch"](false)
        var ok = false
        if (this.magneticDirection == MagneticDirection.Footer) {
            var contentPosition = this.adapter.scrollManager.mainVirtualContentPosition
            var virtualPercentage = (this._prevVirtualSize - this.adapter.viewMainSize) * this.magneticStrength * this.adapter.multiplier
            var offset = Math.abs(contentPosition + virtualPercentage)
            var offset = Math.ceil(offset)
            if (offset >= this._prevVirtualSize - this.adapter.viewMainSize) {
                this.adapter.scrollManager.scrollToFooter(this.magneticDuration)
                ok = true
            }
        } else {
            if (this._prevPercentage <= this.magneticStrength) {
                this.adapter.scrollManager.scrollToHeader(this.magneticDuration)
                ok = true
            }
        }
        this.emit(Event.ON_MAGNETIC, ok)
    }
    // private delayResetForceToFooter() {
    //     this._forceToFooter = false
    // }
    private setFeature(feature: IFeature, index: number) {
        if (feature.code == null) {
            var prefab = this.getPrefab(feature.data)
            if (prefab instanceof cc.Node) {
                var transform = prefab
                feature.code = prefab.uuid
                feature.size = { width: transform.width, height: transform.height }
                feature.point = { x: transform.anchorX, y: transform.anchorY }
                feature.scale = { x: transform.scaleX, y: transform.scaleY }
            } else {
                feature.code = prefab.data.uuid
                feature.size = { width: prefab.data.width, height: prefab.data.height }
                feature.point = { x: prefab.data.anchorX, y: prefab.data.anchorY }
                feature.scale = { x: prefab.data.scaleX, y: prefab.data.scaleY }
            }
        }
        feature.position = { x: 0, y: 0 }
        if (feature.element == null) {
            feature.element = this.getNewViewElement()
        }
        feature.index = index
    }
    private getNewViewElement(): IViewElement {
        return {
            wrapBeforeMode: WrapMode.Wrap,
            wrapAfterMode: WrapMode.Nowrap,
            ignoreLayout: false,
            minSize: { width: 0, height: 0 },
            preferredSize: { width: 0, height: 0 },
            flexibleSize: { width: 0, height: 0 },
            layer: Layer.Lowest,
            fixed: false,
            fixedOffset: 0,
            fixedSpacing: null
        }
    }
    private isWrap(view: View, feature: IFeature<TModelType>, info: IViewInfo) {
        var wrap = false
        var element = feature.element
        var prev = info && info.features[info.features.length - 1]
        if (prev) { //当前view为空 所以无论什么设置都不换行
            switch (element.wrapBeforeMode) {
                case WrapMode.Wrap:
                    wrap = true
                    break
                case WrapMode.Nowrap:
                    // 判断前一个是否允许在其后排列
                    wrap = prev.element.wrapAfterMode == WrapMode.Wrap
                    break
                case WrapMode.Auto:
                    wrap = prev.element.wrapAfterMode == WrapMode.Wrap
                    if (!wrap) { //前一个允许排列其后，计算是否已填满
                        wrap = view.calculateGridInnerSize(feature)
                    }
                    break
            }
            if (element.wrapBeforeMode == WrapMode.Wrap) {
                wrap = true
            } else if (element.wrapBeforeMode == WrapMode.Auto) {
                if (prev.element.wrapAfterMode != WrapMode.Wrap) {
                    wrap = view.calculateGridInnerSize(feature)
                }
            }
        }
        return wrap
    }
    private resetViewInfoList(index: number) {
        var info: IViewInfo = null
        var infoIndex = this.findViewIndexByModelIndex(index)
        var view = this.getViewFromDisableList()
        if (-1 != infoIndex) {
            this._viewList.splice(infoIndex, this._viewList.length)
        }
        var startIndex = 0
        infoIndex = 0
        var last = this._viewList[this._viewList.length - 1]
        if (last) {
            startIndex = last.features[last.features.length - 1].index + 1
            if (!last.full) {
                for (let i = 0; i < last.features.length; i++) {
                    const feature = last.features[i];
                    view["calculateInnerSize"](feature)
                    if (feature.element.fixed) {
                        info.fixed = true
                    }
                }
                info = last
                infoIndex = last.viewIndex
            } else {
                infoIndex = last.viewIndex + 1
            }
        }
        for (let i = startIndex; i < this.adapter.modelManager.length; i++) {
            const feature = this.adapter.modelManager.get(i)
            this.setFeature(feature, i)
            view["calculateElement"](feature)
            var isWrap = this.isWrap(view, feature, info)
            // if (view.isFull(feature)) {
            if (isWrap) {
                info.full = true
                info = null
                view["reset"]()
            }
            if (!info) {
                info = this.getNewViewInfo()
                infoIndex = this._viewList.length
                this._viewList.push(info)
            }
            view["calculateInnerSize"](feature)
            info.size[this.adapter.mainAxis.wh] = view.mainAxisSize
            info.size[this.adapter.crossAxis.wh] = view.crossAxisSize
            info.viewIndex = infoIndex
            info.features.push(feature)
            if (feature.element.fixed) {
                info.fixed = true
            }
        }
        view["reset"]()
        this._disableList.push(view)
        this._fixedList.length = 0
        for (let i = 0; i < this._viewList.length; i++) {
            const info = this._viewList[i];
            if (info.fixed) {
                this._fixedList.push(info.viewIndex)
            }
        }
    }
    private onLayoutParamsChanged() {
        for (let i = 0; i < this._visibleList.length; i++) {
            const view = this._visibleList[i];
            view.layoutHolders(false)
        }
    }
    private resetVisibleList() {
        var holderList = []
        const findHolder = (feature: IFeature<any>) => {
            var index = holderList.findIndex(holder => holder.feature.data == feature.data)
            if (-1 != index) {
                return holderList.splice(index, 1)[0]
            }
            return null
        }
        // 将全部的holder取出来
        var start = this.header ? this.header.viewIndex : null
        for (let i = 0; i < this._visibleList.length; i++) {
            let view = this._visibleList[i]
            holderList = holderList.concat(view.holderList)
            view["reset"]()
        }
        var isLoop = false
        for (let i = 0; i < this._visibleList.length; i++) {
            let view = this._visibleList[i];
            var info = this._viewList[start]
            if (info && isLoop) {
                if (this.header.info == info) {
                    info = null
                }
            }
            if (!info) {
                this._visibleList.splice(i, 1)
                this._disableList.push(view)
                view["disable"]()
                i--
            } else {
                view["calculate"](info, findHolder)
            }
            start++
            if (start > this.viewLength - 1 && (this.loopFooter || this.loopHeader)) {
                start = 0
                isLoop = true
            }
        }
        // 判断是否需要
        var infoIndex = 0
        if (this.footer) {
            if (this.footer.info.full) {
                // 最后一行已满 向后偏移一行继续创建
                infoIndex = this.footer.viewIndex + 1
            } else {
                // 如果最后一行没有满，则说明后面已经没有数据了
                infoIndex = this._viewList.length
            }
        }
        for (let i = infoIndex; i < this._viewList.length; i++) {
            let info = this._viewList[i]
            if (this.visibleSize >= this.adapter.viewMainSize) {
                break //可是尺寸已被填满 无需创建
            }
            var exists = this._visibleList.findIndex(item => {
                return item.info == info
            })
            if (-1 != exists) {
                // console.error("错误 已存在", info)
                break
            }
            const newView = this.getViewFromDisableList()
            newView["calculate"](info, findHolder)
            if (newView.viewIndex == 0 && this._visibleList.length == 0) {
                newView["clampPosition"](null)
            }
            this._visibleList.push(newView)
        }
        this.recycleHolders(holderList)
        // 所有view数据已准备好，直接显示即可
        var prev = null
        for (let i = 0; i < this._visibleList.length; i++) {
            let view = this._visibleList[i];
            view["update"]()
            if (prev) {
                view["clampPosition"](prev, 1)
            }
            prev = view
        }
    }
    private getNewViewInfo() {
        var info: IViewInfo = {
            features: [],
            size: { width: 0, height: 0 },
            full: false,
            viewIndex: 0,
            fixed: false,
            point: { x: 0.5, y: 0.5 },
            totalFlexibleSize: { width: 0, height: 0 },
            totalMinSize: { width: 0, height: 0 },
            totalPreferredSize: { width: 0, height: 0 },
        }
        info.point[this.adapter.mainAxis.xy] = Mathf.clamp01(this.adapter.multiplier)
        return info
    }
    private updateVirtualSize() {
        this._virtualSize = 0
        for (let i = 0; i < this._viewList.length; i++) {
            const info = this._viewList[i];
            this._virtualSize += info.size[this.adapter.mainAxis.wh] + this.spacing
        }
        this._virtualSize -= this.spacing
        this._virtualSize = Math.max(0, this._virtualSize)
        this.adapter.scrollManager["setContentSize"](this._virtualSize)
    }
    private calculateOffsetHeader() {
        if (!this.header) return
        if (this.virtualSize <= this.adapter.viewMainSize) return //console.error("不需要偏移 因为尺寸未填满")
        if (this.loopHeader && this.loopFooter) return
        var headerBoundary = this.header.virtualPosition[this.adapter.mainAxis.xy]
        for (let i = this.header.viewIndex - 1; i >= 0; i--) {
            var info = this._viewList[i]
            var size = info.size[this.adapter.mainAxis.wh]
            headerBoundary += (size + this.spacing) * this.adapter.multiplier
        }
        this._offsetHeader = headerBoundary
        this.adapter.scrollManager["resetVirtualContentPosition"]()
    }
    private viewSizeChange(view: View, oldMainAxisSize: number, isUpdateViewToFooter: boolean) {
        var curSize = view.mainAxisSize
        if (oldMainAxisSize == curSize) {
            return
        }
        this._prevPercentage = this.adapter.scrollManager.percentage
        var cross = curSize - oldMainAxisSize
        this._virtualSize += cross
        this.adapter.scrollManager["setContentSize"](this._virtualSize)
        if (isUpdateViewToFooter) {
            this.clampViews(view)
        }
        this.calculateOffsetHeader()
        this.magneticHandler()
        this.emit(Event.ON_VIRTUAL_SIZE_CHANGED, cross)
    }
    private clampViews(view: View) {
        var visibleIndex
        if (!this.adapter.scrollManager.isScrolling || this.virtualSize < this.adapter.viewMainSize) {
            visibleIndex = this.findVisibleIndexByViewIndex(view.viewIndex)
        } else {
            var center = this.adapter.autoCenterManager.getCenterViewIndex(this.adapter.viewMainSize * 0.5)
            visibleIndex = this.findVisibleIndexByViewIndex(center.viewIndex)
        }
        var prev = this._visibleList[visibleIndex]
        for (let i = visibleIndex - 1; i >= 0; i--) {
            const curr = this._visibleList[i]
            curr["clampPosition"](prev, -1)
            prev = curr
        }
        prev = this._visibleList[visibleIndex]
        for (let i = visibleIndex + 1; i < this._visibleList.length; i++) {
            const curr = this._visibleList[i];
            curr["clampPosition"](prev, 1)
            prev = curr
        }


    }
    private getPrefab(data: any) {
        var prefab = this.adapter.getPrefab(data)
        if (!prefab) {
            throw Error("找不到Prefab")
        }
        return prefab
    }
    private findHolder(feature: IFeature) {
        var index
        if (feature.element.fixed) {
            index = this._fixedHolderList.findIndex(holder => holder.feature.index == feature.index)
            if (-1 != index) {
                return this._fixedHolderList.splice(index, 1)[0]
            }
        }
        index = this._disableHolderList.findIndex(holder => {
            let code = holder.code == feature.code
            let size = holder.transform[this.adapter.mainAxis.wh] == feature.size[this.adapter.mainAxis.wh]
            return code && size
        })
        if (-1 == index) {
            index = this._disableHolderList.findIndex(holder => {
                return holder.code == feature.code
            })
        }
        if (-1 != index) {
            return this._disableHolderList.splice(index, 1)[0]
        }
        return null
    }
    private getViewFromDisableList(): View<TModelType> {
        if (this._disableList.length > 0) {
            var temp = this._disableList.pop()
            if (temp.info) {
                console.error("这个view不是空的")
            }
            return temp
        }
        var view = this.adapter.getView()
        return view
    }
    private checkDisableHeader() {
        // 保证visibleViews里至少留一个
        if (this._visibleList.length <= 1) return
        if (!this.loopFooter && this.footer.viewIndex >= this._viewList.length - 1) return
        if (this.isOutOffsetHeader(this.header)) {
            this.disableHandler(this.header)
            this.checkDisableHeader()
        }
    }
    private checkDisableFooter() {
        // 保证visibleViews里至少留一个
        if (this._visibleList.length <= 1) return
        if (!this.loopHeader && this.header.viewIndex <= 0) return
        if (this.isOutOffsetFooter(this.footer)) {
            this.disableHandler(this.footer)
            this.checkDisableFooter()
        }
    }
    private disableHandler(view: View) {
        var index = this._visibleList.findIndex(item => item.viewIndex == view.viewIndex)
        if (-1 != index) {
            this._visibleList.splice(index, 1)
            this.recycleView(view)
        }
    }
    private disableHandlers(start: number, count: number) {
        var list = this._visibleList.splice(start, count)
        for (let i = 0; i < list.length; i++) {
            const view = list[i];
            this.recycleView(view)
        }
    }
    private recycleView(view: View) {
        this.recycleHolders(view.holderList)
        view["disable"]()
        this._disableList.push(view)
    }
    private recycleHolders(holderList: Holder<TModelType>[]) {
        for (let i = 0; i < holderList.length; i++) {
            this.recycleHolder(holderList[i])
        }
    }
    private recycleHolder(holder: Holder) {
        holder["disable"]()
        this._disableHolderList.push(holder)
    }
    private calculateIndexHeader(index: number, size: number) {
        do {
            if (index == 0) {
                if (this.loopHeader) {
                    index = this._viewList.length
                }
            }
            if (index == 0) {
                return { index, size }
            }
            index--
            var info = this._viewList[index]
            if (!info) {
                return { index, size }
            }
            size += this.calculateSize(index)
            var viewMainSize = this.adapter.viewMainSize
            if (this.adapter.autoCenterManager.enable && !this.loopFooter && this.loopHeader) {
                viewMainSize -= this.adapter.autoCenterManager.centerOffset
            }

            if (size >= viewMainSize) {
                return { index, size }
            }
        } while (true)
    }
    private calculateIndexFooter(index: number, size: number) {
        do {
            if (index == this._viewList.length - 1) {
                if (this.loopFooter) {
                    index = -1
                }
            }
            if (index == this._viewList.length - 1) {
                return { index, size }
            }
            index++
            var viewInfo = this._viewList[index]
            if (!viewInfo) {
                return { index, size }
            }
            size += this.calculateSize(index)
            var viewMainSize = this.adapter.viewMainSize
            if (this.adapter.autoCenterManager.enable && this.loopFooter && !this.loopHeader) {
                viewMainSize -= viewMainSize - this.adapter.autoCenterManager.centerOffset
            }
            if (size >= viewMainSize) {
                return { index, size }
            }
        } while (true)
    }
    private calculateSize(index: number) {
        var info = this._viewList[index]
        if (!info) return 0
        return info.size[this.adapter.mainAxis.wh] + this.spacing
    }
    private isExistsInVisibleViews(index: number) {
        var view = this._visibleList.find(view => view.viewIndex == index)
        return view
    }
    private visibleHandler(index: number, pushFunc: (view: View) => void) {
        var info = this._viewList[index]
        if (!info) return false
        var view = this.getViewFromDisableList()
        view["calculate"](info, null)
        view["update"](false)
        pushFunc(view)
        return true
    }
    private visibleToFooter() {
        if (!this.footer) return
        var mainAxis = this.adapter.mainAxis
        var condition = this.adapter.multiplier == 1 ? this.footer.footerBoundary + this.adapter.viewMainSize >= 0 : this.footer.footerBoundary - this.adapter.viewMainSize <= 0
        if (!condition) return
        var { index, size } = this.calculateIndexFooter(this.footer.viewIndex, this.getInitFooterSize())
        var existsView = this.isExistsInVisibleViews(index)
        if (existsView) {
            if (!this.isOutOffsetHeader(existsView)) {
                this.keepFillingHeader(this.footer.viewIndex, this._visibleList.length - 1)
                return
            }
        }
        var viewInfo = this._viewList[index]
        if (!viewInfo) return
        var position = this.calculatePositionFooter(size, viewInfo.size[mainAxis.wh])
        if (index == this.footer.viewIndex) {
            this.footer["updateMainPosition"](position)
        } else {
            condition = this.visibleHandler(index, view => {
                view["updateMainPosition"](position)
                this._visibleList.push(view)
            })
        }
        if (!condition) return
        this.keepFillingFooter(index, this._visibleList.length - 1)
        if (this.adapter.autoCenterManager.enable && this.loopFooter && !this.loopHeader) {
            this.visibleToFooter()
        }
    }
    private keepFillingHeader(modelIndex: number, viewIndex: number) {
        var nextIndex = viewIndex + 1
        var curr = this._visibleList[viewIndex]
        var next = this._visibleList[nextIndex]
        if (next) {
            if (modelIndex - next.viewIndex == this._viewList.length - 1) {
                next["clampPosition"](curr, 1)
                this.keepFillingHeader(next.viewIndex, nextIndex)
                return
            }
            if (next.viewIndex - modelIndex != 1) {
                this.disableHandlers(viewIndex + 1, this._visibleList.length)
            } else {
                next["clampPosition"](curr, 1)
                this.keepFillingHeader(next.viewIndex, nextIndex)
                return
            }
        }
        var condition = this.adapter.multiplier == 1 ? this.footer.footerBoundary + this.adapter.viewMainSize > 0 : this.footer.footerBoundary - this.adapter.viewMainSize < 0
        if (this.visibleSize < this.adapter.viewMainSize || condition) {
            var index = modelIndex + 1
            if (index >= this._viewList.length) {
                if (this.loopFooter) {
                    index = 0
                } else {
                    return //console.log(`已经是 ${this._viewInfoList.length} 个了 不需要创建了`)
                }
            }
            if (this.isExistsInVisibleViews(index)) {
                return //console.log(`${index} 已存在`)
            }
            var ok = this.visibleHandler(index, view => {
                // view.updatePositionRelativeToFooter(curr)
                view["clampPosition"](curr, 1)
                this._visibleList.push(view)
            })
            if (ok) {
                this.keepFillingHeader(this.footer.viewIndex, this._visibleList.length - 1)
            }
        }
    }
    private keepFillingFooter(index: number, viewIndex: number) {
        var prevIndex = viewIndex - 1
        var curr = this._visibleList[viewIndex]
        var prev = this._visibleList[prevIndex]
        if (prev) {
            if (prev.viewIndex - index == this._viewList.length - 1) {
                prev["clampPosition"](curr, -1)
                this.keepFillingFooter(prev.viewIndex, prevIndex)
                return
            }
            if (index - prev.viewIndex != 1) {
                this.disableHandlers(0, viewIndex)
            } else {
                prev["clampPosition"](curr, -1)
                this.keepFillingFooter(prev.viewIndex, prevIndex)
                return
            }
        }
        var condition = this.adapter.multiplier == 1 ? this.header.headerBoundary < 0 : this.header.headerBoundary > 0
        if (this.visibleSize < this.adapter.viewMainSize || condition) {
            var index = index - 1
            if (index < 0) {
                var loop = false
                if (this.adapter.isVertical) {
                    loop = this.adapter.isArrangeStart ? this.adapter.scrollManager.scrollDirection == ScrollDirection.Up : this.adapter.scrollManager.scrollDirection == ScrollDirection.Down
                } else {
                    loop = this.adapter.isArrangeStart ? this.adapter.scrollManager.scrollDirection == ScrollDirection.Left : this.adapter.scrollManager.scrollDirection == ScrollDirection.Right
                }
                if (loop && this.loopFooter || this.loopHeader) {
                    index = this._viewList.length - 1
                } else {
                    return
                }
            }
            if (this.isExistsInVisibleViews(index)) {
                return
            }
            var ok = this.visibleHandler(index, view => {
                view["clampPosition"](curr, -1)
                this._visibleList.unshift(view)
            })
            if (ok) {
                this.keepFillingFooter(this.header.viewIndex, 0)
            }
        }
    }
    private visibleToHeader() {
        if (!this.header) return
        var condition = this.adapter.multiplier == 1 ? this.header.headerBoundary <= 0 : this.header.headerBoundary >= 0
        if (!condition) return
        var { index, size } = this.calculateIndexHeader(this.header.viewIndex, this.getInitHeaderSize())
        var existsView = this.isExistsInVisibleViews(index)
        if (existsView) {
            if (!this.isOutOffsetFooter(existsView)) {
                this.keepFillingFooter(this.header.viewIndex, 0)
                return
            }
        }
        var position = this.calculatePositionHeader(size)
        condition = true
        if (index == this.header.viewIndex) {
            this.header["updateMainPosition"](position)
        } else {
            condition = this.visibleHandler(index, view => {
                view["updateMainPosition"](position)
                this._visibleList.unshift(view)
            })
        }
        if (!condition) return
        this.keepFillingHeader(index, 0)

        if (this.adapter.autoCenterManager.enable && !this.loopFooter && this.loopHeader) {
            this.visibleToHeader()
        }
    }
    private onScroll() {
        if (this._visibleList.length == 0) return
        switch (this.adapter.scrollManager.scrollDirection) {
            case ScrollDirection.Up:
                if (this.adapter.isArrangeStart) {
                    this.checkDisableHeader()
                    this.visibleToFooter()
                } else {
                    this.checkDisableFooter()
                    this.visibleToHeader()
                }
                break
            case ScrollDirection.Down:
                if (this.adapter.isArrangeStart) {
                    this.checkDisableFooter()
                    this.visibleToHeader()
                } else {
                    this.checkDisableHeader()
                    this.visibleToFooter()
                }
                break
            case ScrollDirection.Left:
                if (this.adapter.isArrangeStart) {
                    this.checkDisableHeader()
                    this.visibleToFooter()
                } else {
                    this.checkDisableFooter()
                    this.visibleToHeader()
                }
                break
            case ScrollDirection.Right:
                if (this.adapter.isArrangeStart) {
                    this.checkDisableFooter()
                    this.visibleToHeader()
                } else {
                    this.checkDisableHeader()
                    this.visibleToFooter()
                }
                break
        }
        this.calculateFixedViews()
    }
    private calculateFixedViews() {
        // 至少要有一个fixed
        if (!this.header) return
        // 找出应该显示的最后一条
        var currentViewIndex = -1
        for (let i = this._fixedList.length - 1; i >= 0; i--) {
            var viewIndex = this._fixedList[i]
            if (this.header.viewIndex > viewIndex) {
                // 走到这里表明可见列表中没有这条数据
                currentViewIndex = viewIndex
                break
            }
        }
        if (-1 != currentViewIndex) {
            // console.log("当前至少应该显示", currentViewIndex)
            var info = this._viewList[currentViewIndex]
            if (!info) return
            var layout = false
            for (let i = 0; i < info.features.length; i++) {
                const feature = info.features[i];
                var index = this._fixedHolderList.findIndex(holder => holder.feature.index == feature.index)
                if (-1 == index) {
                    if (feature.element.fixed) {
                        for (let i = 0; i < this._fixedHolderList.length; i++) {
                            const holder = this._fixedHolderList[i];
                            if (holder.info.viewIndex == info.viewIndex) continue
                            holder["disable"]()
                            this._disableHolderList.push(holder)
                            this._fixedHolderList.splice(i, 1)
                            i--
                        }
                        var prefab = this.getPrefab(feature.data)
                        var holder = this.getHolderFromDisableHolderList(feature, prefab)
                        holder["visible"](feature, info, null)
                        this._fixedHolderList.push(holder)
                        layout = true
                    }
                }
            }
            if (layout) {
                var position = this.getFixedVirtualPosition(info.viewIndex)
                this.layoutFixedHolders(info, position)
            }
        }
    }
    private getFixedVirtualPosition(viewIndex: number) {
        var size = this.getInitHeaderSize()
        for (let i = this.header.viewIndex - 1; i >= 0; i--) {
            var curr = this._viewList[i]
            size += curr.size[this.adapter.mainAxis.wh] + this.spacing
            if (i == viewIndex) {
                break
            }
        }
        return this.calculatePositionHeader(size)
    }
    private getHolderFromDisableHolderList(feature: IFeature, prefab: cc.Node | cc.Prefab): Holder<TModelType> {
        var cache = this.findHolder(feature)
        var layerNode = this.adapter.scrollManager.getLayerNode(feature.element.layer)
        if (cache) {
            if (cache.node.parent != layerNode) {
                cache.node.parent = layerNode
            }
            return cache
        }
        var node = cc.instantiate(prefab) as cc.Node
        node.parent = layerNode
        var holder = this.adapter.getHolder(node, feature.code)
        return holder
    }
    /** 
     * 判断给定view是否超出Header
     */
    private isOutOffsetHeader(view: View, defaultOffset: number = DISABLE_OUT_OFFSET) {
        return this.adapter.multiplier == 1 ? view.footerBoundary >= defaultOffset : view.footerBoundary <= -defaultOffset
    }
    /**
     * 判断给定view是否超出Footer
     */
    private isOutOffsetFooter(view: View, defaultOffset: number = DISABLE_OUT_OFFSET) {
        return this.adapter.multiplier == 1 ? view.headerBoundary + this.adapter.viewMainSize <= -defaultOffset : view.headerBoundary - this.adapter.viewMainSize >= defaultOffset
    }
    /**
     * 获取尾部初始化尺寸
     */
    private getInitFooterSize() {
        if (!this.footer) return 0
        var contentOffset = this.adapter.scrollManager.mainContentPosition
        var value = this.adapter.multiplier * -this.footer.virtualPosition[this.adapter.mainAxis.xy]
            + this.footer.virtualSize[this.adapter.mainAxis.wh]
            - this.adapter.multiplier * contentOffset
        return value
    }
    /**
     * 获取头部初始化尺寸
     */
    private getInitHeaderSize() {
        if (!this.header) return 0
        var contentOffset = this.adapter.scrollManager.mainContentPosition
        return this.adapter.viewMainSize - (
            this.adapter.multiplier * -this.header.virtualPosition[this.adapter.mainAxis.xy]
            - this.adapter.multiplier * contentOffset)
    }
    private calculatePositionFooter(totalSize: number, size: number) {
        var contentOffset = this.adapter.scrollManager.mainContentPosition
        return -contentOffset - (this.adapter.multiplier * totalSize - this.adapter.multiplier * size)
    }
    private calculatePositionHeader(totalSize: number) {
        var contentOffset = this.adapter.scrollManager.mainContentPosition
        return (this.adapter.multiplier * totalSize - this.adapter.multiplier * this.adapter.viewMainSize) - contentOffset
    }


}

