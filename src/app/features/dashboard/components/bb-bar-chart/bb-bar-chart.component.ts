import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  ViewEncapsulation
} from '@angular/core';
import { v4 as uuid } from 'uuid';
import { bar, bb } from 'billboard.js';
import { Chart } from 'billboard.js/types/chart';

/**
 * Bar chart series
 */
export interface IBbBarChartSeries {
  // unique key
  key: string;

  // translated label displayed in legend / tooltip
  label: string;

  // one value per category (same order as categories)
  values: number[];

  // bar color
  color: string;
}

@Component({
  selector: 'app-bb-bar-chart',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './bb-bar-chart.component.html',
  styleUrls: ['./bb-bar-chart.component.scss']
})
export class BbBarChartComponent implements OnChanges, OnDestroy {
  // chart id
  chartId: string = `chart${uuid()}`;

  // x axis categories
  @Input() categories: string[] = [];

  // series
  @Input() series: IBbBarChartSeries[] = [];

  // horizontal bars ?
  @Input() rotated: boolean = false;

  // series stacked in the same bar position ? (e.g. age pyramid)
  @Input() stacked: boolean = false;

  // display values as absolute numbers ? (e.g. age pyramid uses negative values for the left side)
  @Input() absoluteValues: boolean = false;

  // legend
  @Input() showLegend: boolean = false;

  // axis labels
  @Input() xLabel: string = '';
  @Input() yLabel: string = '';

  // text displayed above each bar and in the tooltip - receives the value and the category index
  @Input() valueFormatter: (value: number, categoryIndex: number) => string;

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
   * Format value displayed to the user
   */
  private formatValue(
    value: number,
    categoryIndex: number
  ): string {
    // absolute ?
    const displayValue: number = this.absoluteValues ?
      Math.abs(value) :
      value;

    // custom format ?
    return this.valueFormatter ?
      this.valueFormatter(displayValue, categoryIndex) :
      String(displayValue);
  }

  /**
   * Render chart
   */
  private render(): void {
    // destroy before re-init
    this.destroyChart();

    // nothing to render ?
    if (
      !this.categories?.length ||
      !this.series?.length
    ) {
      return;
    }

    // map data
    const columns: (string | number)[][] = [];
    const names: { [key: string]: string } = {};
    const colors: { [key: string]: string } = {};
    let maxValue: number = 0;
    this.series.forEach((item) => {
      columns.push([item.key, ...item.values]);
      names[item.key] = item.label;
      colors[item.key] = item.color;
      item.values.forEach((value) => {
        maxValue = Math.max(maxValue, Math.abs(value));
      });
    });

    // symmetric axis when we have negative values (e.g. age pyramid)
    // - 20% extra room so the labels of the longest bars aren't cut
    const axisLimit: number = Math.ceil(maxValue * 1.2);
    const yAxisLimits: { min?: number, max?: number } = this.absoluteValues ? {
      min: -axisLimit,
      max: axisLimit
    } : {};

    // create chart
    this._chart = bb.generate({
      bindto: `#${this.chartId}`,
      data: {
        columns,
        names,
        colors,
        type: bar(),
        order: null,
        groups: this.stacked ?
          [this.series.map((item) => item.key)] :
          [],
        labels: {
          format: (value: number, _id: string, index: number): string => value ?
            this.formatValue(value, index) :
            ''
        }
      },
      bar: {
        width: {
          ratio: 0.8
        }
      },
      axis: {
        rotated: this.rotated,
        x: {
          type: 'category',
          categories: this.categories,
          label: {
            text: this.xLabel,
            position: this.rotated ?
              'outer-middle' :
              'outer-center'
          },
          tick: {
            multiline: false
          }
        },
        y: {
          ...yAxisLimits,
          padding: this.absoluteValues ? {
            top: 0,
            bottom: 0
          } : {
            top: 30,
            bottom: 0
          },
          label: {
            text: this.yLabel,
            position: this.rotated ?
              'outer-center' :
              'outer-middle'
          },
          tick: {
            format: (value: number): string => {
              const displayValue: number = this.absoluteValues ?
                Math.abs(value) :
                value;
              return displayValue % 1 === 0 ?
                String(displayValue) :
                '';
            }
          }
        }
      },
      grid: {
        y: {
          lines: this.absoluteValues ?
            [{ value: 0 }] :
            []
        }
      },
      tooltip: {
        format: {
          value: (value: number, _ratio: number, _id: string, index: number): string => this.formatValue(value, index)
        }
      },
      legend: {
        show: this.showLegend
      },
      padding: {
        right: 30,
        bottom: 20
      },
      transition: {
        duration: 0
      }
    });
  }
}