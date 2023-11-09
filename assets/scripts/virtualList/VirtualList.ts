/*
 * @Author: HanYaJun
 * @Date: 2023-11-09 10:19:28
 * @Email: hanyajun@wedobest.com.cn
 * @Description: 虚拟列表
 */

import * as cc from 'cc';
import { DoublyLinkedList } from './DoublyLinkedList';

const trace = function (...args) {
    console.log("main【HYJ】", ...args);
}
const traceError = function (...args) {
    console.error("main【HYJ】", ...args);
}

const { ccclass, property } = cc._decorator;

export type VirtualScrollViewClickCallback = (index: number) => void;

@ccclass('VirtualList')
export class VirtualList extends cc.ScrollView {

    //======================================= 垂直滚动 =======================================

    //#region 

    @property({
        type: cc.CCFloat,
        visible() {
            return this.vertical === true;
        },
        tooltip: '子节点高度'
    })
    private itemHeight: number = -1;

    @property({
        type: cc.CCFloat,
        tooltip: '上边界间距',
        visible() {
            return this.vertical === true;
        },
        range: [0, 500]
    })
    private paddingTop: number = 0;

    @property({
        type: cc.CCFloat,
        tooltip: '下边界间距',
        visible() {
            return this.vertical === true;
        },
        range: [0, 500]
    })
    private paddingBottom: number = 0;

    @property({
        type: cc.CCFloat,
        visible() {
            return this.vertical === true;
        },
        tooltip: '垂直方向间距',
    })
    private paddingY: number = 0;

    //#region 

    //======================================= 垂直滚动-end =======================================

    /**********************************************水平滚动***********************************************/

    //#region 

    @property({
        type: cc.CCFloat,
        visible() {
            return this.horizontal === true;
        },
        tooltip: '子节点宽度'
    })
    private itemWidth: number = 0;

    @property({
        type: cc.CCFloat,
        tooltip: '左边界间距',
        visible() {
            return this.horizontal === true;
        },
        range: [0, 500]
    })
    private paddingLeft: number = 0;

    @property({
        type: cc.CCFloat,
        tooltip: '右边界间距',
        visible() {
            return this.horizontal === true;
        },
        range: [0, 500]
    })
    private paddingRight: number = 0;

    @property({
        type: cc.CCFloat,
        visible() {
            return this.horizontal === true;
        },
        tooltip: '水平方向间距',
    })
    private paddingX: number = 0;

    /**content锚点位置(中间: 0, 左边: -1  ) */
    private contentPonit: number = null;
    /**计算偏移量，使布局容器可视区域居中 */
    private offsetX: number = 0;

    //#endregion

    @property({
        type: cc.Prefab,
        tooltip: '子节点模板'
    })
    private itemPre: cc.Prefab = null;

    /** 超出屏幕后还显示的个数 */
    private overViewCount: number = 2;

    /** 开始下标 */
    private startIndex: number = 0;

    /**item 数据 */
    private data: any[] = [];

    //======================================= 数据记录，不要修改 =======================================

    /** 实际节点链表双向链表 */
    private itemNodeList: DoublyLinkedList<cc.Node> = new DoublyLinkedList();
    /**最顶部/左边的位置，超过回收 */
    private tLPos: number = 0;
    /**最底部/右边的位置，超过回收 */
    private bRPos: number = 0;
    /**最顶部/左边的下标 */
    private tLIndex: number = 0;
    /**最底部/右边的下标 */
    private bRIndex: number = 0;
    /** 最近一次更新content的位置 */
    private lastContentPos: number = 0;
    /**父节点宽度/高度 */
    private contentParentWH: number = 0;
    /**根据父节点计算需要创建的item个数 */
    private itemCount: number = null;

    // 动画相关

    /**item 动画位置 */
    private aniPos: number = 0;
    /**点击回调 */
    private clickCallback: VirtualScrollViewClickCallback | null = null;

    //======================================= 数据记录，不要修改-end =======================================

    /**
     * @description: 当该组件被销毁时调用 该方法为生命周期方法，父类未必会有实现
     * @return {*}
     */
    protected onDestroy(): void {
        this.node.off(cc.ScrollView.EventType.SCROLLING, this.onScrolling, this);
        this.data = null;
    }

    /**
     * @description: 该方法为生命周期方法
     * @return {*}
     */
    public start() {
        this.node.on(cc.ScrollView.EventType.SCROLLING, this.onScrolling, this);
    }

    /**
     * @description: 初始化数据
     * @param {any} data item 数据
     * @param {VirtualScrollViewClickCallback} clickCallback 点击回调
     * @return {*}
     */
    public initData(data: any[], clickCallback?: VirtualScrollViewClickCallback) {
        if (!this.itemPre) {
            traceError('子节点模版为空');
            return;
        }
        this.clickCallback = clickCallback;

        // 垂直和水平同时开启
        if (this.vertical && this.horizontal) {
            return;
        }

        this.data = data;

        // item 内容
        const contentTra: cc.UITransform = this.content.getComponent(cc.UITransform);
        // item 预制
        const itemNode: cc.Node = cc.instantiate(this.itemPre);

        // 水平滚动
        if (this.horizontal) {
            // 修改 content 锚点
            let contentPos: cc.Vec3 = this.content.getPosition().clone();
            let size: cc.UITransform = this.node.getComponent(cc.UITransform);
            // 内容宽度
            let contenwidth: number = (this.itemWidth + this.paddingX) * (this.data.length - 1) + this.itemWidth + this.paddingLeft + this.paddingRight;
            if (contenwidth <= size.width) {
                // 设置锚点为中间
                contentTra.setAnchorPoint(0.5, 0.5);
                this.contentPonit = 0;
            } else {
                // 设置锚点为左边
                contentTra.setAnchorPoint(0, 0.5);
                this.content.setPosition(cc.v3(-(size.width / 2), contentPos.y, contentPos.z));
                this.contentPonit = -1;
            }
            // 设置滑动区域宽度
            if (this.itemWidth <= 0) {
                this.itemWidth = itemNode.getComponent(cc.UITransform).width;
            }
            contentTra.width = contenwidth;

            this.content.parent.getComponent(cc.Widget).updateAlignment();
            this.horizontalScrolling();
        }
        // 垂直滚动
        if (this.vertical) {
            // 修改 content 锚点为顶部
            contentTra.setAnchorPoint(0.5, 1);
            // 设置滑动区域高度
            if (this.itemHeight <= 0) {
                this.itemHeight = itemNode.getComponent(cc.UITransform).height;
            }
            contentTra.height = (this.itemHeight + this.paddingY) * (this.data.length - 1) + this.itemHeight + this.paddingTop + this.paddingBottom;
            this.content.parent.getComponent(cc.Widget).updateAlignment();
            this.verticalScrolling();
        }
    }

    /**
     * @description: 水平滚动
     * @return {*}
     */
    private horizontalScrolling(): void {
        this.contentParentWH = this.content.parent.getComponent(cc.UITransform).width;
        // 每一页展示的 item 数量
        const onePageItemCount: number = Math.ceil(this.contentParentWH / (this.itemWidth + this.paddingX));
        // 最左边和最右边的动画相关位置
        this.aniPos = -(this.contentParentWH / 2 - this.itemWidth / 2);

        // 最左边和最右边的位置
        if (this.contentPonit === 0) {
            // itemCount = Math.floor((this.contentParentWH - this.paddingLeft - this.paddingRight) / ((this.itemWidth + this.paddingX)));
            this.itemCount = this.data.length;
        } else if (this.contentPonit === -1) {
            // 最顶部/左边的位置，超过回收
            this.tLPos = -((this.itemWidth + this.paddingX) * (this.overViewCount - 1) + this.itemWidth / 2 + this.contentParentWH / 2);
            // 最底部/右边的位置，超过回收
            this.bRPos = (this.itemWidth + this.paddingX) * (this.overViewCount + onePageItemCount - 1) + this.itemWidth / 2 - this.contentParentWH / 2;
            this.itemCount = Math.ceil(this.contentParentWH / (this.itemWidth + this.paddingX)) + (this.overViewCount | 0) * 2;
        }
        // 根据父节点计算需要创建的item个数
        trace('最左边位置', this.tLPos, '最右边位置', this.bRPos, '列表大小', this.itemCount);
        if (this.startIndex >= this.itemCount) {
            traceError('startIndex大于默认开始需要创建的item个数, 如果数据总量较少, 无需使用virtualScrollView');
            return;
        }
        this.initBaseItem(this.itemCount);

    }

    /**
     * @description: 垂直滚动
     * @return {*}
     */
    private verticalScrolling(): void {
        this.contentParentWH = this.content.parent.getComponent(cc.UITransform).height;
        const onePageItemCount = Math.ceil(this.contentParentWH / (this.itemHeight + this.paddingY));

        //最顶部和最底部的位置
        this.tLPos = (this.itemHeight + this.paddingY) * (this.overViewCount - 1) + this.itemHeight / 2 + this.contentParentWH / 2;
        this.bRPos = -(((this.itemHeight + this.paddingY) * (this.overViewCount + onePageItemCount - 1) + this.itemHeight / 2 - this.contentParentWH / 2));
        // 最顶部和最底部的动画相关位置
        this.aniPos = this.contentParentWH / 2 - this.itemHeight / 2;

        //根据父节点计算需要创建的item个数
        this.itemCount = Math.ceil(this.contentParentWH / (this.itemHeight + this.paddingY)) + (this.overViewCount | 0) * 2;

        trace('最顶部位置', this.tLPos, '最底部位置', this.bRPos, '列表大小', this.itemCount);

        if (this.startIndex >= this.itemCount) {
            traceError('startIndex大于默认开始需要创建的item个数, 如果数据总量较少, 无需使用virtualScrollView');
            return;
        }
        this.initBaseItem(this.itemCount);
    }


    /**
     * @description: 初始化基础item个数
     * @param {number} itemCount item 数量
     * @return {*}
     */
    private initBaseItem(itemCount: number) {
        this.tLIndex = this.startIndex;
        this.bRIndex = this.startIndex + itemCount - 1;

        if (this.horizontal) {
            // 水平
            let totalWidth: number = this.data.length * this.itemWidth;
            // 间隔数
            let divisor: number = ((this.data.length / 2) - 0.5);
            // 计算偏移量，使布局容器可视区域居中
            this.offsetX = -totalWidth / 2 - (this.paddingX * divisor) + this.paddingLeft;
        }

        for (let i = 0; i < itemCount; i++) {
            const itemNode: cc.Node = cc.instantiate(this.itemPre);
            this.itemNodeList.tailAppend(itemNode);
            this.content.addChild(itemNode);
            const index: number = i + this.startIndex;
            this.itemUpdate(itemNode, index);
            const relY = itemNode.position.y + this.content.position.y;
            trace('初始位置', relY, '下标', index);
        }
        if (this.horizontal) {
            this.setHorizontalContentPos();
        }
    }

    /**
     * @description: 设置水平滚动 content 位置
     * @return {*}
     */
    private setHorizontalContentPos(): void {
        // item 内容
        const contentTra: cc.UITransform = this.content.getComponent(cc.UITransform);
        let size: cc.UITransform = this.node.getComponent(cc.UITransform);
        // 内容宽度
        let contenwidth: number = (this.itemWidth + this.paddingX) * (this.data.length - 1) + this.itemWidth + this.paddingLeft + this.paddingRight;
        if (contenwidth <= size.width) {
            // 设置锚点为中间
            contentTra.setAnchorPoint(0.5, 0.5);
            this.content.setPosition(0, 0, 0);
        }
        this.content.parent.getComponent(cc.Widget).updateAlignment();
    }

    /**
     * @description: 更新节点位置
     * @param {Node} itemNode item 节点
     * @param {number} index 索引
     * @return {*}
     */
    private itemUpdate(itemNode: cc.Node, index: number) {
        let itemPos: number = null;
        // 设置位置
        if (this.horizontal) {
            // 水平滚动
            if (this.contentPonit === 0) {
                itemPos = this.offsetX + this.itemWidth / 2;
                itemNode.setPosition(itemPos, 0, 0);
                this.offsetX += this.itemWidth + this.paddingX;
            } else if (this.contentPonit === -1) {
                itemPos = this.paddingLeft + (this.itemWidth + this.paddingX) * index + this.itemWidth / 2;
                itemNode.setPosition(itemPos, 0, 0);
            }
            trace('水平排列位置, itemPos:', itemPos);
        }
        if (this.vertical) {
            // 垂直滚动
            itemPos = this.paddingTop + (this.itemHeight + this.paddingY) * index + this.itemHeight / 2;
            itemNode.setPosition(0, -itemPos, 0);
            trace('垂直排列位置, itemPos:', itemPos);
        }
        // 点击 item 回调方法设置
        itemNode.components.forEach(comp => {
            const func = comp[virtualScrollViewFunc.virtualScrollViewData];
            if (typeof func === 'function') {
                if (index >= 0 && index < this.data.length) {
                    func.call(comp, index, this.data[index], (index: number) => {
                        trace('点击了item', index)
                        this.clickCallback && this.clickCallback(index);
                    });
                }
            }
        })
    }

    /**
     * @description: item 垂直滑动动画
     * @return {*}
     */
    private itemAniVer(): void {
        this.itemNodeList.forEach(itemNode => {
            const relY = itemNode.position.y + this.content.position.y;
            if (relY > this.aniPos) {
                const ratio = (relY - this.aniPos) / this.itemHeight;
                trace('ratio1', ratio);
                const opacity = 255 - ratio * 255;
                this.setOpacity(itemNode, opacity);
                const scale = this.scaleRange(1 - ratio, 0, 1, 0.9, 1);
                this.setScale(itemNode, scale);
            } else if (relY < -this.aniPos) {
                const ratio = (-this.aniPos - relY) / this.itemHeight;
                trace('ratio2', ratio);
                const opacity = 255 - ratio * 255;
                this.setOpacity(itemNode, opacity);
                const scale = this.scaleRange(1 - ratio, 0, 1, 0.9, 1);
                this.setScale(itemNode, scale);
            } else {
                this.setOpacity(itemNode, 255);
                this.setScale(itemNode, 1);
            }
        })
    }

    /**
     * @description: item 水平滑动动画
     * @return {*}
     */
    private itemAniHor(): void {
        this.itemNodeList.forEach(itemNode => {
            const relX: number = itemNode.position.x + this.content.position.x;
            if (relX < this.aniPos) {
                // 左滑
                const ratio = (relX - this.aniPos) / this.itemWidth;
                trace('ratio1', ratio);
                const opacity = 255 + ratio * 255;
                this.setOpacity(itemNode, opacity);
                const scale = this.scaleRange(1 + ratio, 0, 1, 0.9, 1);
                trace('左滑, scale:', scale);
                this.setScale(itemNode, scale);
            } else if (relX > -this.aniPos) {
                // 右滑
                const ratio = (-this.aniPos - relX) / this.itemWidth;
                trace('ratio2', ratio);
                const opacity = 255 + ratio * 255;
                this.setOpacity(itemNode, opacity);
                const scale = this.scaleRange(1 + ratio, 0, 1, 0.9, 1);
                trace('右滑, scale:', scale);
                this.setScale(itemNode, scale);
            } else {
                this.setOpacity(itemNode, 255);
                this.setScale(itemNode, 1);
            }
        })
    }

    /**
     * @description: 设置 item 透明度
     * @param {Node} node item 节点
     * @param {number} opacity 透明度
     * @return {*}
     */
    private setOpacity(node: cc.Node, opacity: number) {
        opacity = opacity > 255 ? 255 : opacity;
        opacity = opacity < 0 ? 0 : opacity;
        let itemNodeOpacity = node.getComponent(cc.UIOpacity);
        if (!itemNodeOpacity) {
            itemNodeOpacity = node.addComponent(cc.UIOpacity);
        }
        itemNodeOpacity.opacity = opacity;
    }

    /**
     * @description: 设置节点的缩放
     * @param {Node} node item 节点
     * @param {number} scale 缩放值
     * @return {*}
     */
    private setScale(node: cc.Node, scale: number) {
        node.setScale(cc.v3(scale, scale, 1));
    }

    /**
     * @description: 在滑动scrollView
     * @return {*}
     */
    private onScrolling(): void {
        const contentPos: Readonly<cc.Vec3> = this.content.position;
        if (this.horizontal) {
            // 水平滑动
            this.beSlidingHor(contentPos);
        }

        if (this.vertical) {
            // 垂直滑动
            this.beSlidingVer(contentPos);
        }
    }

    /**
     * @description: 正在垂直滑动
     * @param {Readonly} contentPos
     * @return {*}
     */
    private beSlidingVer(contentPos: Readonly<cc.Vec3>): void {
        //上滑
        if (contentPos.y > this.lastContentPos && this.bRIndex < (this.data.length - 1)) {
            for (let i = 0; i < this.overViewCount; i++) {
                const relY = this.itemNodeList.First.position.y + contentPos.y;
                trace('实际位置', relY);
                if (relY > this.aniPos) {
                    if (relY > this.tLPos) {
                        this.bRIndex++;
                        this.tLIndex++;
                        const firstNode = this.itemNodeList.popFirst();
                        this.itemUpdate(firstNode, this.bRIndex);
                        this.itemNodeList.tailAppend(firstNode);
                        this.setOpacity(firstNode, 255);
                    } else {
                        trace('执行动画1');
                    }
                } else {
                    break;
                }
            }
        }
        //下滑
        if (contentPos.y < this.lastContentPos && this.tLIndex > 0) {
            for (let i = 0; i < this.overViewCount; i++) {
                const relY = this.itemNodeList.Last.position.y + contentPos.y;
                trace('位置信息', relY, this.aniPos, this.bRPos);
                if (relY < -this.aniPos) {
                    if (relY < this.bRPos) {
                        this.tLIndex--;
                        this.bRIndex--;
                        const lastNode = this.itemNodeList.popLast();
                        this.itemNodeList.headAppend(lastNode);
                        this.itemUpdate(lastNode, this.tLIndex);
                        this.setOpacity(lastNode, 255);
                    } else {
                        trace('执行动画2');
                    }
                } else {
                    break;
                }
            }
        }
        this.itemAniVer();
        this.lastContentPos = contentPos.y;
    }

    /**
     * @description: 正在水平滑动
     * @param {Readonly} contentPos
     * @return {*}
     */
    private beSlidingHor(contentPos: Readonly<cc.Vec3>): void {
        // 左滑
        if (contentPos.x < this.lastContentPos && this.bRIndex < (this.data.length - 1)) {
            // content 位置
            const relX: number = this.itemNodeList.First.position.x + contentPos.x;
            if (relX < this.tLPos) {
                trace('this.bRIndex:', this.bRIndex, 'data.length -1:', this.data.length - 1);
                this.bRIndex++;
                this.tLIndex++;
                const firstNode = this.itemNodeList.popFirst();
                this.itemUpdate(firstNode, this.bRIndex);
                this.itemNodeList.tailAppend(firstNode);
                this.setOpacity(firstNode, 255);
            }
        }

        // 右滑
        if (contentPos.x > this.lastContentPos && this.tLIndex > 0) {
            // content 位置
            const relX: number = this.itemNodeList.Last.position.x + contentPos.x;
            if (relX > this.bRPos) {
                this.tLIndex--;
                this.bRIndex--;
                const lastNode = this.itemNodeList.popLast();
                this.itemNodeList.headAppend(lastNode);
                this.itemUpdate(lastNode, this.tLIndex);
                this.setOpacity(lastNode, 255);
            }
        }
        this.itemAniHor();
        this.lastContentPos = contentPos.x;
    }

    /**
     * @description: 缩放范围
     * @param {number} value
     * @param {number} min
     * @param {number} max
     * @param {number} newMin
     * @param {number} newMax
     * @return {*}
     */
    private scaleRange(value: number, min: number, max: number, newMin: number, newMax: number): number {
        const percent = (value - min) / (max - min);
        return percent * (newMax - newMin) + newMin;
    }

    /**
     * @description: 垂直滑动到下标
     * @param {number} index 缩影
     * @param {number} time 时间
     * @return {*}
     */
    public verScrollToIndex(index: number, time: number) {
        const offsetY: number = this.paddingTop + (this.itemHeight + this.paddingY) * index - this.itemHeight / 2;
        this.scrollToOffset(cc.v2(0, offsetY), time);
    }

    /**
     * @description: 水平滑动到下标
     * @param {number} index 缩影
     * @param {number} time 时间
     * @return {*}
     */
    public horScrollToIndex(index: number, time: number) {
        const offsetX: number = this.paddingLeft + (this.itemWidth + this.paddingX) * index - this.itemWidth / 2;
        this.scrollToOffset(cc.v2(0, offsetX), time);
    }


}

/**
 * @description:  生命周期方法
 */
export enum virtualScrollViewFunc {
    virtualScrollViewData = "virtualScrollViewData",
}

