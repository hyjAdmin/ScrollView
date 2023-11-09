import { IParams, Manager } from '../abstract/Manager';
import { Mathf } from '../helper/Mathf';
import { IFeature } from '../interface/interface';
enum Event {
    /** 当数据被清空时 */
    ON_CLEAR,
    /** 当添加数据时 */
    ON_INSERT,
    /** 当删除数据时 */
    ON_REMOVE,
    /** 当移动数据时 */
    ON_MOVE,
    /** 用户数据发生了改变 */
    ON_REFRESH
}
interface ModelParams extends IParams {
    [Event.ON_INSERT]: {
        params: [index: number],
        return: void
    }
    [Event.ON_REMOVE]: {
        params: [index: number],
        return: void
    }
}
export class ModelManager<TModel = any> extends Manager<Event, ModelParams> {
    static Event = Event
    private _modelList: IFeature<TModel>[] = []
    get length() { return this._modelList.length }
    protected onInit(): void {
    }
    private createFeature(data: TModel): IFeature<TModel> {
        var feature: IFeature<TModel> = {
            code: null,
            size: null,
            data: data,
            index: null,
            element: null,
            scale: null,
            point: null,
            position: null,
        }
        return feature
    }
    /**
     * 插入数据
     * @param model 数据
     * @param insertIndex 插入索引，默认向后插入
     */
    insert(model: TModel | TModel[], insertIndex: number = this.length) {
        var array = this.toArray(model)
        insertIndex = Mathf.clamp(insertIndex, 0, this.length)
        var index = insertIndex
        for (let i = 0; i < array.length; i++) {
            const data = array[i];
            var feature = this.createFeature(data)
            this.insertHandler(index, feature)
            index++
        }
        if (array.length > 0) {
            this.emit(Event.ON_INSERT, insertIndex)
        }
    }
    /**
     * 移动数据
     * @param startIndex 起始索引
     * @param count 总数
     * @param moveIndex 要移动到哪个索引位置
     */
    move(startIndex: number, count: number, moveIndex: number) {
        var moveList = this._modelList.splice(startIndex, count)
        this.insertHandler(moveIndex, ...moveList)
        var index = Math.min(startIndex, moveIndex)
        this.emit(Event.ON_MOVE, index)
    }
    /**
     * 删除数据
     * @param startIndex 要删除的索引
     * @param count 删除总数
     */
    remove(startIndex: number, count?: number)
    /**
     * 删除数据
     * @param data 要删除的一个或一组数据
     */
    remove(data: TModel | TModel[])
    remove(indexOrData: number | TModel | TModel[], count: number = 1) {
        var removeIndex = this._modelList.length
        if (typeof indexOrData == "number") {
            count = Math.max(count, 0)
            if (indexOrData < 0 || count == 0) {
                return
            }
            removeIndex = indexOrData
            this._modelList.splice(indexOrData, count)
        } else {
            var removeList = []
            if (indexOrData instanceof Array) {
                removeList = indexOrData
            } else {
                removeList = [indexOrData]
            }
            if (removeList.length == 0) {
                return
            }
            for (let i = 0; i < removeList.length; i++) {
                const data = removeList[i];
                var index = this._modelList.findIndex(feature => feature.data == data)
                if (-1 != index) {
                    removeIndex = Math.min(removeIndex, index)
                    this._modelList.splice(index, 1)
                }
            }
        }
        if (this.length == 0) {
            this.emit(Event.ON_CLEAR)
        } else {
            this.emit(Event.ON_REMOVE, removeIndex)
        }
    }
    /**
     * 清理所有数据
     */
    clear() {
        this._modelList.length = 0
        this.emit(Event.ON_CLEAR)
    }
    /**
     * 获取一条数据     
     * @param index 数据索引
     */
    get(index: number): IFeature<TModel> | null {
        if (isNaN(index)) return null
        return this._modelList[index]
    }
    /**
     * 数据是否存在
     * @param index 数据索引
     */
    has(index: number): boolean {
        return !!this._modelList[index]
    }
    /**
     * 返回指定区间数据
     * @param start 起始索引
     * @param end 结束索引
     */
    slice(start: number, end: number) {
        if (this.length == 0) return []
        return this._modelList.slice(start, end)
    }
    /**
     * 刷新数据
     */
    refresh() {
        this.emit(Event.ON_REFRESH)
    }
    private toArray(model: TModel | TModel[]) {
        var array: TModel[]
        if (model instanceof Array) {
            array = model
        } else {
            array = [model]
        }
        return array
    }
    private insertHandler(index: number, ...params: any) {
        this._modelList.splice(index, 0, ...params)
    }
}

