import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  ViewEncapsulation
} from '@angular/core';
import { v4 as uuid } from 'uuid';
import { bb, donut } from 'billboard.js';
import { Chart } from 'billboard.js/types/chart';

/**
 * Donut chart item
 */
export interface IBbDonutChartItem {
  // unique key (e.g. reference data value)
  key: string;

  // translated label displayed in legend / tooltip
  label: string;

  // number of records
  value: number;

  // slice color
  color: string;
}

@Component({
  selector: 'app-bb-donut-chart',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './bb-donut-chart.component.html',
  styleUrls: ['./bb-donut-chart.component.scss']
})
export class BbDonutChartComponent implements OnChanges, OnDestroy {
  // chart id
  chartId: string = `chart${uuid()}`;

  // data
  @Input() items: IBbDonutChartItem[] = [];

  // text displayed in the middle of the donut (e.g. "136 cases")
  @Input() centerTitle: string = '';

  // chart
  private _chart: Chart;

  // render timer
  private _renderTimeout: number;

  /**
   * Inputs changed
   */
  ngOnChanges(): void {
    // stop previous
    this.stopRenderTimer();

    // render after binding
    this._renderTimeout = setTimeout(() => {
      this._renderTimeout = undefined;
      this.render();
    });
  }

  /**
   * Release resources
   */
  ngOnDestroy(): void {
    this.destroyChart();
  }

  /**
   * Stop render timer
   */
  private stopRenderTimer(): void {
    if (this._renderTimeout) {
      clearTimeout(this._renderTimeout);
      this._renderTimeout = undefined;
    }
  }

  /**
   * Destroy chart
   */
  private destroyChart(): void {
    // stop render
    this.stopRenderTimer();

    // destroy chart
    if (this._chart) {
      this._chart.destroy();
      this._chart = null;
    }
  }

  /**
   * Render chart
   */
  private render(): void {
    // destroy before re-init
    this.destroyChart();

    // nothing to render ?
    if (!this.items?.length) {
      return;
    }

    // map data
    const columns: [string, number][] = [];
    const names: { [key: string]: string } = {};
    const colors: { [key: string]: string } = {};
    this.items.forEach((item) => {
      columns.push([item.key, item.value]);
      names[item.key] = item.label;
      colors[item.key] = item.color;
    });

    // create chart
    this._chart = bb.generate({
      bindto: `#${this.chartId}`,
      data: {
        columns,
        names,
        colors,
        type: donut(),
        order: null
      },
      donut: {
        title: this.centerTitle,
        label: {
          format: (_value: number, ratio: number): string => `${(ratio * 100).toFixed(1)}%`,
          threshold: 0.05
        }
      },
      tooltip: {
        format: {
          value: (value: number, ratio: number): string => `${value} (${(ratio * 100).toFixed(1)}%)`
        }
      },
      legend: {
        show: true
      },
      transition: {
        duration: 0
      }
    });
  }
}