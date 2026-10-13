import {
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';
import * as d3 from 'd3';

/**
 * Boxplot - one box
 */
export interface IBoxplotChartBox {
  // unique key (e.g. year)
  key: string;

  // label displayed under the box (e.g. 2024)
  label: string;

  // second line displayed under the box (e.g. n = 31)
  subLabel: string;

  // box values
  whiskerLow: number;
  q1: number;
  median: number;
  q3: number;
  whiskerHigh: number;

  // complementary information
  mean: number;
  ciLow: number | null;
  ciHigh: number | null;

  // values outside the whiskers
  outliers: {
    value: number,
    count: number
  }[];
}

/**
 * Boxplot - translated labels used in tooltips
 */
export interface IBoxplotChartLabels {
  q1: string;
  median: string;
  q3: string;
  whiskerLow: string;
  whiskerHigh: string;
  mean: string;
  ci: string;
  outlier: string;
  unit: string;
}

@Component({
  selector: 'app-boxplot-chart',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './boxplot-chart.component.html',
  styleUrls: ['./boxplot-chart.component.scss']
})
export class BoxplotChartComponent implements OnChanges, OnDestroy {
  // chart height (px)
  private static readonly HEIGHT: number = 340;

  // maximum box width (px)
  private static readonly MAX_BOX_WIDTH: number = 70;

  // container
  @ViewChild('chart', { static: true }) private _chartElement: ElementRef<HTMLDivElement>;

  // boxes
  @Input() boxes: IBoxplotChartBox[] = [];

  // y axis label
  @Input() yLabel: string = '';

  // tooltip labels
  @Input() labels: IBoxplotChartLabels;

  // box color
  @Input() boxColor: string = '#2F7977';

  // mean & CI color
  @Input() meanColor: string = '#F57C00';

  // render timer
  private _renderTimeout: number;

  /**
   * Re-render when the window is resized
   */
  @HostListener('window:resize')
  onResize(): void {
    this.scheduleRender();
  }

  /**
   * Inputs changed
   */
  ngOnChanges(): void {
    this.scheduleRender();
  }

  /**
   * Release resources
   */
  ngOnDestroy(): void {
    this.stopRenderTimer();
    this.clear();
  }

  /**
   * Render after binding / resize
   */
  private scheduleRender(): void {
    // stop previous
    this.stopRenderTimer();

    // render
    this._renderTimeout = setTimeout(() => {
      this._renderTimeout = undefined;
      this.render();
    }, 100);
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
   * Remove chart
   */
  private clear(): void {
    if (this._chartElement?.nativeElement) {
      d3.select(this._chartElement.nativeElement).selectAll('*').remove();
    }
  }

  /**
   * Format a number with at most one decimal
   */
  private formatNumber(value: number): string {
    return Number.isInteger(value) ?
      String(value) :
      value.toFixed(1);
  }

  /**
   * Render chart
   */
  private render(): void {
    // remove previous
    this.clear();

    // nothing to render ?
    const element: HTMLDivElement = this._chartElement?.nativeElement;
    if (
      !element ||
      !this.boxes?.length
    ) {
      return;
    }

    // sizes
    const margin = { top: 16, right: 16, bottom: 52, left: 56 };
    const width: number = Math.max(element.clientWidth, 300);
    const innerWidth: number = width - margin.left - margin.right;
    const innerHeight: number = BoxplotChartComponent.HEIGHT - margin.top - margin.bottom;

    // y domain
    let maxValue: number = 0;
    this.boxes.forEach((box) => {
      maxValue = Math.max(
        maxValue,
        box.whiskerHigh,
        box.ciHigh ?? 0,
        ...box.outliers.map((outlier) => outlier.value)
      );
    });

    // scales
    const x = d3.scaleBand<string>()
      .domain(this.boxes.map((box) => box.key))
      .range([0, innerWidth])
      .padding(0.3);
    const y = d3.scaleLinear()
      .domain([0, Math.max(maxValue, 1) * 1.05])
      .nice()
      .range([innerHeight, 0]);
    const boxWidth: number = Math.min(x.bandwidth(), BoxplotChartComponent.MAX_BOX_WIDTH);

    // svg
    const svg = d3.select(element)
      .append('svg')
      .attr('width', width)
      .attr('height', BoxplotChartComponent.HEIGHT);
    const chart = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // y axis + grid
    chart.append('g')
      .attr('class', 'gd-boxplot-chart-grid')
      .call(
        d3.axisLeft(y)
          .ticks(6)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
      );
    chart.append('g')
      .attr('class', 'gd-boxplot-chart-axis')
      .call(d3.axisLeft(y).ticks(6));

    // y label
    chart.append('text')
      .attr('class', 'gd-boxplot-chart-axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -42)
      .attr('text-anchor', 'middle')
      .text(this.yLabel);

    // x axis
    const boxesByKey: { [key: string]: IBoxplotChartBox } = {};
    this.boxes.forEach((box) => {
      boxesByKey[box.key] = box;
    });
    const xAxis = chart.append('g')
      .attr('class', 'gd-boxplot-chart-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3.axisBottom(x)
          .tickFormat((key: string) => boxesByKey[key].label)
      );
    xAxis.selectAll('.tick')
      .append('text')
      .attr('class', 'gd-boxplot-chart-sub-label')
      .attr('y', 32)
      .attr('text-anchor', 'middle')
      .text((key: unknown) => boxesByKey[key as string].subLabel);

    // boxes
    this.boxes.forEach((box) => {
      // center
      const center: number = x(box.key) + x.bandwidth() / 2;
      const left: number = center - boxWidth / 2;
      const group = chart.append('g');

      // tooltip
      const tooltip: string = [
        `${box.label} (${box.subLabel})`,
        `${this.labels?.whiskerHigh}: ${this.formatNumber(box.whiskerHigh)} ${this.labels?.unit}`,
        `${this.labels?.q3}: ${this.formatNumber(box.q3)} ${this.labels?.unit}`,
        `${this.labels?.median}: ${this.formatNumber(box.median)} ${this.labels?.unit}`,
        `${this.labels?.q1}: ${this.formatNumber(box.q1)} ${this.labels?.unit}`,
        `${this.labels?.whiskerLow}: ${this.formatNumber(box.whiskerLow)} ${this.labels?.unit}`,
        `${this.labels?.mean}: ${box.mean.toFixed(1)} ${this.labels?.unit}`,
        box.ciLow !== null && box.ciHigh !== null ?
          `${this.labels?.ci}: ${box.ciLow.toFixed(1)} - ${box.ciHigh.toFixed(1)} ${this.labels?.unit}` :
          null
      ].filter((line) => line !== null).join('\n');

      // whiskers - vertical lines
      group.append('line')
        .attr('class', 'gd-boxplot-chart-whisker')
        .attr('x1', center)
        .attr('x2', center)
        .attr('y1', y(box.whiskerLow))
        .attr('y2', y(box.q1));
      group.append('line')
        .attr('class', 'gd-boxplot-chart-whisker')
        .attr('x1', center)
        .attr('x2', center)
        .attr('y1', y(box.q3))
        .attr('y2', y(box.whiskerHigh));

      // whiskers - caps
      [box.whiskerLow, box.whiskerHigh].forEach((value) => {
        group.append('line')
          .attr('class', 'gd-boxplot-chart-whisker')
          .attr('x1', center - boxWidth / 4)
          .attr('x2', center + boxWidth / 4)
          .attr('y1', y(value))
          .attr('y2', y(value));
      });

      // box (Q1 - Q3)
      group.append('rect')
        .attr('class', 'gd-boxplot-chart-box')
        .attr('x', left)
        .attr('y', y(box.q3))
        .attr('width', boxWidth)
        .attr('height', Math.max(y(box.q1) - y(box.q3), 1))
        .attr('fill', this.boxColor)
        .attr('stroke', this.boxColor)
        .append('title')
        .text(tooltip);

      // median
      group.append('line')
        .attr('class', 'gd-boxplot-chart-median')
        .attr('x1', left)
        .attr('x2', left + boxWidth)
        .attr('y1', y(box.median))
        .attr('y2', y(box.median))
        .attr('stroke', this.boxColor);

      // mean 95% CI
      if (
        box.ciLow !== null &&
        box.ciHigh !== null
      ) {
        const ciX: number = center + boxWidth / 4;
        group.append('line')
          .attr('class', 'gd-boxplot-chart-ci')
          .attr('x1', ciX)
          .attr('x2', ciX)
          .attr('y1', y(Math.max(box.ciLow, 0)))
          .attr('y2', y(box.ciHigh))
          .attr('stroke', this.meanColor);
        [Math.max(box.ciLow, 0), box.ciHigh].forEach((value) => {
          group.append('line')
            .attr('class', 'gd-boxplot-chart-ci')
            .attr('x1', ciX - 3)
            .attr('x2', ciX + 3)
            .attr('y1', y(value))
            .attr('y2', y(value))
            .attr('stroke', this.meanColor);
        });
      }

      // mean
      group.append('circle')
        .attr('class', 'gd-boxplot-chart-mean')
        .attr('cx', center + boxWidth / 4)
        .attr('cy', y(box.mean))
        .attr('r', 4)
        .attr('fill', this.meanColor)
        .append('title')
        .text(tooltip);

      // outliers
      box.outliers.forEach((outlier) => {
        group.append('circle')
          .attr('class', 'gd-boxplot-chart-outlier')
          .attr('cx', center)
          .attr('cy', y(outlier.value))
          .attr('r', 3.5)
          .attr('stroke', this.boxColor)
          .append('title')
          .text(`${this.labels?.outlier}: ${this.formatNumber(outlier.value)} ${this.labels?.unit} (n = ${outlier.count})`);
      });
    });
  }
}