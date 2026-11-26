import { Component, Input, OnChanges, OnDestroy, ViewEncapsulation } from '@angular/core';
import { v4 as uuid } from 'uuid';
import { area, bb } from 'billboard.js';
import { Chart } from 'billboard.js/types/chart';

@Component({
  selector: 'app-bb-area-line-chart',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './bb-area-line-chart.component.html',
  styleUrls: ['./bb-area-line-chart.component.scss']
})
export class BbAreaLineChartComponent implements OnChanges, OnDestroy {
  // chart id
  chartId: string = `chart${uuid()}`;

  // data
  @Input() categories: string[] = [];
  @Input() values: number[] = [];
  @Input() seriesLabel: string = '';
  @Input() color: string;

  // axis labels
  @Input() xLabel: string = '';
  @Input() yLabel: string = '';

  // chart
  private _chart: Chart;
  private _timeoutCall: any;

  /**
   * Inputs changed
   */
  ngOnChanges(): void {
    // wait for the view to be ready
    this.stopRender();
    this._timeoutCall = setTimeout(() => {
      this._timeoutCall = undefined;
      this.render();
    });
  }

  /**
   * Component destroyed
   */
  ngOnDestroy(): void {
    this.stopRender();
    this.destroyChart();
  }

  /**
   * Stop pending render
   */
  private stopRender(): void {
    if (this._timeoutCall) {
      clearTimeout(this._timeoutCall);
      this._timeoutCall = undefined;
    }
  }

  /**
   * Destroy chart
   */
  private destroyChart(): void {
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

    // render
    const seriesLabel: string = this.seriesLabel || 'value';
    this._chart = bb.generate({
      bindto: `#${this.chartId}`,
      transition: {
        duration: 0
      },
      data: {
        columns: [
          [seriesLabel, ...(this.values || [])]
        ],
        type: area(),
        colors: this.color ?
          { [seriesLabel]: this.color } :
          undefined
      },
      point: {
        r: 3
      },
      axis: {
        x: {
          type: 'category',
          categories: this.categories || [],
          label: {
            text: this.xLabel,
            position: 'outer-center'
          },
          tick: {
            multiline: false,
            culling: {
              max: 20
            }
          }
        },
        y: {
          min: 0,
          padding: {
            bottom: 0
          },
          label: {
            text: this.yLabel,
            position: 'outer-middle'
          },
          tick: {
            format: (value: number) => value % 1 === 0 ? String(value) : ''
          }
        }
      },
      grid: {
        y: {
          show: true
        }
      },
      legend: {
        show: false
      },
      padding: {
        right: 30,
        bottom: 20
      }
    });
  }
}