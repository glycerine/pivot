'use strict';

import { List } from 'immutable';
import { Class, Instance, isInstanceOf, arraysEqual } from 'immutable-class';
import { Timezone, Duration, day, hour } from 'chronoshift';
import { $, Expression, TimeRange, TimeBucketAction } from 'plywood';
import { listsEqual } from '../../utils/general';
import { Dimension } from '../dimension/dimension';
import { DataSource } from '../data-source/data-source';
import { Filter } from '../filter/filter';
import { SplitCombine, SplitCombineJS } from '../split-combine/split-combine';

function getBestGranularity(timeRange: TimeRange): Duration {
  var len = timeRange.end.valueOf() - timeRange.start.valueOf();
  if (len > 6 * day.canonicalLength) {
    return Duration.fromJS('P1D');
  } else if (len > 12 * hour.canonicalLength) {
    return Duration.fromJS('PT1H');
  } else {
    return Duration.fromJS('PT1M');
  }
}

function withholdSplit(splits: List<SplitCombine>, split: SplitCombine, allowIndex: number): List<SplitCombine> {
  return <List<SplitCombine>>splits.filter((s, i) => {
    return i === allowIndex || !s.equals(split);
  });
}

export type SplitsValue = List<SplitCombine>;
export type SplitsJS = SplitCombineJS[];

var check: Class<SplitsValue, SplitsJS>;
export class Splits implements Instance<SplitsValue, SplitsJS> {
  static EMPTY: Splits;

  static isSplits(candidate: any): boolean {
    return isInstanceOf(candidate, Splits);
  }

  static fromSplitCombine(splitCombine: SplitCombine): Splits {
    return new Splits(<List<SplitCombine>>List([splitCombine]));
  }

  static fromJS(parameters: SplitsJS): Splits {
    return new Splits(List(parameters.map(splitCombine => SplitCombine.fromJS(splitCombine))));
  }


  public splitCombines: List<SplitCombine>;

  constructor(parameters: SplitsValue) {
    this.splitCombines = parameters;
  }

  public valueOf(): SplitsValue {
    return this.splitCombines;
  }

  public toJS(): SplitsJS {
    return this.splitCombines.toArray().map(splitCombine => splitCombine.toJS());
  }

  public toJSON(): SplitsJS {
    return this.toJS();
  }

  public toString() {
    return this.splitCombines.map(splitCombine => splitCombine.toString()).join(',');
  }

  public equals(other: Splits): boolean {
    return Splits.isSplits(other) &&
      listsEqual(this.splitCombines, other.splitCombines);
  }

  public replaceByIndex(index: number, replace: SplitCombine): Splits {
    var { splitCombines } = this;
    if (splitCombines.size === index) return this.insertByIndex(index, replace);
    splitCombines = <List<SplitCombine>>splitCombines.map((s, i) => i === index ? replace : s);
    splitCombines = withholdSplit(splitCombines, replace, index);
    return new Splits(splitCombines);
  }

  public insertByIndex(index: number, insert: SplitCombine): Splits {
    var { splitCombines } = this;
    splitCombines = <List<SplitCombine>>splitCombines.splice(index, 0, insert);
    splitCombines = withholdSplit(splitCombines, insert, index);
    return new Splits(splitCombines);
  }

  public addSplit(split: SplitCombine): Splits {
    var { splitCombines } = this;
    return this.insertByIndex(splitCombines.size, split);
  }

  public removeSplit(split: SplitCombine): Splits {
    return new Splits(<List<SplitCombine>>this.splitCombines.filter(s => s !== split));
  }

  public getTitle(dataSource: DataSource): string {
    return this.splitCombines.map(s => s.getDimension(dataSource).title).join(', ');
  }

  public length(): number {
    return this.splitCombines.size;
  }

  public forEach(sideEffect: (value?: SplitCombine, key?: number, iter?: List<SplitCombine>) => any, context?: any): number {
    return this.splitCombines.forEach(sideEffect, context);
  }

  public get(index: number): SplitCombine {
    return this.splitCombines.get(index);
  }

  public first(): SplitCombine {
    return this.splitCombines.first();
  }

  public last(): SplitCombine {
    return this.splitCombines.last();
  }

  public hasSplit(split: SplitCombine): boolean {
    return Boolean(this.splitCombines.find((s) => s.equals(split)));
  }

  public replace(search: SplitCombine, replace: SplitCombine): Splits {
    return new Splits(<List<SplitCombine>>this.splitCombines.map((s) => s === search ? replace : s));
  }

  public toArray(): SplitCombine[] {
    return this.splitCombines.toArray();
  }

  public updateWithFilter(dataSource: DataSource, filter: Filter): Splits {
    var splitCombines = this.splitCombines;
    if (splitCombines.size !== 1) return this;

    var timeSplit = splitCombines.get(0);
    var timeBucketAction = <TimeBucketAction>timeSplit.bucketAction;
    if (!timeBucketAction) return this;

    var timeRange = filter.getTimeRange(dataSource.getDimension('time').expression);
    if (!timeRange) return this;

    var granularity = getBestGranularity(timeRange);
    if (timeBucketAction.duration.equals(granularity)) return this;

    return Splits.fromSplitCombine(timeSplit.changeBucketAction(new TimeBucketAction({
      timezone: timeBucketAction.timezone,
      duration: granularity
    })));
  }

}
check = Splits;

Splits.EMPTY = new Splits(<List<SplitCombine>>List());