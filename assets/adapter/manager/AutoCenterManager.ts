import { Manager } from '../abstract/Manager';
import { ScrollManager } from './ScrollManager';
const { ccclass, property } = cc._decorator;
@ccclass("AutoCenterManager")
export class AutoCenterManager extends Manager {
    @property() enable: boolean = false
    @property({
        visible: function () { return this.enable }
    }) duration: number = 1
    @property({
        range: [0, 1],
        slide: true,
        step: 0.1,
        visible: function () { return this.enable }
    }) containerAnchorPoint: number = 0.5
    @property({
        range: [0, 1],
        slide: true,
        step: 0.1,
        visible: function () { return this.enable }
    }) elementAnchorPoint: number = 0.5
    get centerOffset() {
        var offset = 0
        if (this.enable) {
            var point = 0
            if (this.adapter.isHorizontal) {
                point = this.adapter.multiplier == -1 ? this.containerAnchorPoint : 1 - this.containerAnchorPoint
            } else {
                point = this.adapter.multiplier == 1 ? this.containerAnchorPoint : 1 - this.containerAnchorPoint
            }
            offset = this.adapter.viewMainSize * point
        }
        return offset
    }
    get elementOffset() {
        var offset = 0
        if (this.enable) {
            if (this.adapter.horizontal) {
                offset = this.adapter.multiplier == -1 ? this.elementAnchorPoint : 1 - this.elementAnchorPoint
            } else {
                offset = this.adapter.multiplier == 1 ? this.elementAnchorPoint : 1 - this.elementAnchorPoint
            }
        }
        return offset
    }
    get max() {
        if (this.adapter.isArrangeStart) {
            return this.centerOffset
        }
        return this.adapter.viewMainSize - this.centerOffset
    }
    get min() {
        if (this.adapter.isArrangeStart) {
            return this.adapter.viewMainSize - this.centerOffset
        } else {
            return this.centerOffset
        }
    }

    protected onInit(): void {
        this.adapter.scrollManager.on(ScrollManager.Event.ON_ABOUT_TO_STOP, this.onAboutToStop, this)
    }
    private onAboutToStop() {
        if (!this.enable) return
        this.scrollToCenter()
    }
    /**
     * 滚动到距离中心最近的位置
     */
    scrollToCenter() {
        if (!this.enable) return
        var { viewIndex, modelIndex } = this.getCenterViewIndex()
        if (-1 == modelIndex) return
        this.adapter.scrollManager.scrollToViewIndex(this.duration, viewIndex)
    }
    /**
     * 获取中心索引
     */
    getCenterViewIndex(offset: number = this.centerOffset) {
        var mainAxis = this.adapter.mainAxis
        var minDistance = Number.MAX_SAFE_INTEGER
        var center = offset
        var viewIndex = -1
        var modelIndex = -1
        for (let i = 0; i < this.adapter.viewManager.visibleLength; i++) {
            const view = this.adapter.viewManager.getVisibleViewByIndex(i)
            var position = view.getPosition()
            position[mainAxis.xy] -= this.adapter.multiplier * view.mainAxisSize * 0.5
            var world = this.adapter.scrollManager.content.convertToWorldSpaceAR(cc.v3(position.x, position.y))
            var local = this.adapter.scrollManager.view.convertToNodeSpaceAR(world)
            var distance = Math.abs(local[mainAxis.xy] + this.adapter.multiplier * center)
            if (distance < minDistance) {
                minDistance = distance
                viewIndex = view.viewIndex
                modelIndex = view.holderList[0].feature.index
            }
        }
        return { viewIndex, modelIndex }
    }
    getPercentageByViewIndex(viewIndex: number, alwaysScrollToHeader: boolean = false, alwaysScrollToFooter: boolean = false, stopCall: boolean = false): number | null {
        var view = this.adapter.viewManager.getVisibleViewByViewIndex(viewIndex)
        if (view) {
            var condition = true
            if (!this.adapter.viewManager.loopFooter && viewIndex == 0 && this.adapter.viewManager.footer.viewIndex != this.adapter.viewManager.viewLength - 1) {
                condition = false
            }
            if (condition) {
                return this.calculatePercentage(view.getPosition()[this.adapter.mainAxis.xy], view.mainAxisSize)
            }
        }
        if (!stopCall) {
            return this.calculatePercentagByViewIndex(viewIndex, alwaysScrollToHeader, alwaysScrollToFooter)
        }
        return null
    }
    private calculatePercentagByViewIndex(viewIndex: number, alwaysScrollToHeader: boolean = false, alwaysScrollToFooter: boolean = false): number | null {
        var info = this.adapter.viewManager.getViewByViewIndex(viewIndex)
        if (!info) return null
        var mainAxis = this.adapter.mainAxis
        if (alwaysScrollToHeader && this.adapter.viewManager.loopHeader) {
            let size = this.adapter.viewManager["getInitHeaderSize"]()
            if (viewIndex != this.adapter.viewManager.header.viewIndex) {
                size = this.calculateSizeToHeader(this.adapter.viewManager.header.viewIndex, viewIndex, size)
            }
            let position = this.adapter.viewManager["calculatePositionHeader"](size)
            return this.calculatePercentage(position, info.size[mainAxis.wh])
        } else if (alwaysScrollToFooter && this.adapter.viewManager.loopFooter) {
            let size = this.adapter.viewManager["getInitFooterSize"]()
            if (viewIndex != this.adapter.viewManager.footer.viewIndex) {
                size = this.calculateSizeToFooter(this.adapter.viewManager.footer.viewIndex, viewIndex, size)
            }
            let position = this.adapter.viewManager["calculatePositionFooter"](size, info.size[mainAxis.wh])
            return this.calculatePercentage(position, info.size[mainAxis.wh])
        }

        if (viewIndex <= this.adapter.viewManager.header.viewIndex) {
            let size = this.adapter.viewManager["getInitHeaderSize"]()
            for (let i = this.adapter.viewManager.header.viewIndex - 1; i >= viewIndex; i--) {
                size += this.adapter.viewManager["calculateSize"](i)
            }
            let position = this.adapter.viewManager["calculatePositionHeader"](size)
            return this.calculatePercentage(position, info.size[mainAxis.wh])
        } else if (viewIndex >= this.adapter.viewManager.footer.viewIndex) {
            let size = this.adapter.viewManager["getInitFooterSize"]()
            for (let i = this.adapter.viewManager.footer.viewIndex + 1; i <= viewIndex; i++) {
                size += this.adapter.viewManager["calculateSize"](i)
            }
            let position = this.adapter.viewManager["calculatePositionFooter"](size, info.size[mainAxis.wh])
            return this.calculatePercentage(position, info.size[mainAxis.wh])
        } else {
            //  一定在可视区域内
            return this.getPercentageByViewIndex(viewIndex, alwaysScrollToHeader, alwaysScrollToFooter, true)
        }
    }

    getPercentageByModelIndex(modelIndex: number, alwaysScrollToHeader: boolean = false, alwaysScrollToFooter: boolean = false): number | null {
        var viewIndex = this.adapter.viewManager.findViewIndexByModelIndex(modelIndex)
        if (!alwaysScrollToHeader && !alwaysScrollToFooter) {
            return this.getPercentageByViewIndex(viewIndex)
        }
        return this.calculatePercentagByViewIndex(viewIndex, alwaysScrollToHeader, alwaysScrollToFooter)
    }
    private calculateSizeToHeader(index: number, targetIndex: number, size: number) {
        do {
            index--
            if (index < 0) {
                if (!this.adapter.viewManager.loopHeader) {
                    return size
                }
                index = this.adapter.viewManager.viewLength - 1
            }
            size += this.adapter.viewManager["calculateSize"](index)
            if (targetIndex == index) return size
        } while (true);
    }
    private calculateSizeToFooter(index: number, targetIndex: number, size: number) {
        do {
            index++
            if (index >= this.adapter.viewManager.viewLength) {
                if (!this.adapter.viewManager.loopFooter) {
                    return size
                }
                index = 0
            }
            size += this.adapter.viewManager["calculateSize"](index)
            if (index == targetIndex) return size
        } while (true)
    }
    private calculatePercentage(mainAxisPosition: number, mainAxisSize: number): number {
        var hiddenSize = this.adapter.scrollManager.hiddenSize
        mainAxisPosition = this.adapter.multiplier * -mainAxisPosition
        if (this.enable) {
            var viewOffset = this.adapter.multiplier * (mainAxisSize * this.elementOffset)
            mainAxisPosition -= this.centerOffset
            mainAxisPosition += mainAxisSize - this.adapter.multiplier * viewOffset
        } else {
            if (this.adapter.viewManager.virtualSize < this.adapter.viewMainSize) {
                return null
            }
            if (!this.adapter.viewManager.loopFooter) {
                var offset = 0
                var paddingHeader = 0
                if (this.adapter.isVertical) {
                    paddingHeader = this.adapter.isArrangeStart ? this.adapter.viewManager.top : -this.adapter.viewManager.bottom
                } else {
                    paddingHeader = this.adapter.isArrangeStart ? -this.adapter.viewManager.left : this.adapter.viewManager.right
                }
                var mainContentPosition = Math.abs(this.adapter.scrollManager.mainContentPosition)
                var mainVirtualContentPosition = Math.abs(this.adapter.scrollManager.mainVirtualContentPosition + paddingHeader)
                if (mainAxisPosition > 0) {
                    offset = mainContentPosition - mainVirtualContentPosition + hiddenSize
                } else if (mainAxisPosition < 0) {
                    offset = hiddenSize - (mainContentPosition + mainVirtualContentPosition)
                }
                if (mainAxisPosition > offset) {
                    mainAxisPosition = offset
                }
            }
            // if (isFooter) {
            //     mainAxisPosition -= this.adapter.viewMainSize - mainAxisSize
            // }
        }
        // console.error(`
        //     ${mainAxisPosition} / ${hiddenSize} 
        //     virtualSize: ${this.adapter.viewManager.virtualSize}
        //     mainContentPosition: ${this.adapter.scrollManager.mainContentPosition}
        //     mainVirtualContentPosition: ${this.adapter.scrollManager.mainVirtualContentPosition}
        //     viewMainSize: ${this.adapter.viewMainSize}
        //     offsetHeader ${this.adapter.viewManager.offsetHeader}
        // `)
        // console.log(mainAxisPosition, "/", hiddenSize)

        var value = mainAxisPosition / hiddenSize
        return value
    }

}