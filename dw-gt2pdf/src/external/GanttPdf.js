function DWGanttPdf() {
  'use strict';

  const TITLE_HEIGHT = 58;
  const GRID_WIDTH = 610;
  const SCALE_HEIGHT = 50;
  const SCALE_WIDTH = 25;
  const LINE_HEIGHT = 25;

  const ICON_WIDTH = 58;

  const TASK_WBS_WIDTH = 30;
  const TASK_TEXT_WIDTH = 250;
  const TASK_DATE_WIDTH = 60;
  const TASK_STATUS_WIDTH = 60;
  const TASK_PERCENT_WIDTH = 60;
  const TASK_DAYS_WIDTH = 80;

  const TASK_COLORS = [
    '#2d74dc',
    '#00aace',
    '#f38137',
    '#f559a5',
    '#c0d261',
    '#4194b8',
    '#1dad62',
    '#b7b8ba',
    '#a079c2',
  ];

  this.export = function (fileName, gantt, styles, options) {
    let ganttData = [];
    let parentMap = {};
    let count = 0;
    let startDate = undefined, endDate = undefined;
    let title = options.title;
    let statusIcons = options.statusIcons;
    gantt.eachTask(task => {
      let taskData = {
        id: task.id,
        wbs: gantt.getWBSCode(task),
        text: task.text,
        startDate: new Date(task.start_date),
        endDate: new Date(task.end_date),
        status: statusIcons[task.status % statusIcons.length],
        progress: Math.ceil(task.progress * 100),
        style: number(styles[task.workType]) % TASK_COLORS.length,
        duration: Math.max(1, Math.ceil(parseFloat(task.duration) / 8.0))
      };

      if (task.type === gantt.config.types.project) {
        taskData.children = [];
        taskData.isProject = true;
      } else {
        taskData.isProject = false;
        if (!startDate) {
          startDate = new Date(taskData.startDate);
        } else {
          if (startDate.getTime() > taskData.startDate.getTime()) {
            startDate.setTime(taskData.startDate.getTime());
          }
        }

        if (!endDate) {
          endDate = new Date(taskData.endDate);
        } else {
          if (endDate.getTime() < taskData.endDate.getTime()) {
            endDate.setTime(taskData.endDate.getTime());
          }
        }
      }

      if (task.parent) {
        let parent = parentMap[task.id];
        if (parent) {
          parent.children.push(taskData);
        } else {
          ganttData.push(taskData);
        }
      } else {
        ganttData.push(taskData);
      }
      count ++;
    });

    if (!startDate) {
      startDate = new Date();
      startDate.setDate(1);
    }

    if (!endDate) {
      endDate = new Date();
      endDate.setDate(endDate.getDaysInMonth());
    }

    startDate.setHours(0,0,0,0);
    endDate.setHours(23, 59, 59, 999);

    let dayCount = Math.ceil(Math.abs((endDate - startDate) / (24 * 3600000)));

    generate(fileName, {
      icon: options.icon,
      logo: options.logo,
      title: title,
      tasks: ganttData,
      startDate: startDate,
      endDate: endDate,
      taskCount: count,
      dayCount: dayCount
    })
      .then(() => {

      })
      .catch(err => {
        console.error(err);
      });
  }

  async function generate(fileName, data) {
    let pageWidth = GRID_WIDTH + SCALE_WIDTH * data.dayCount;
    let pageHeight = TITLE_HEIGHT + SCALE_HEIGHT + LINE_HEIGHT * data.taskCount;
    let orientation = pageWidth > pageHeight ? 'l' : 'p';
    let pdf = new dwPdf({orientation: orientation, unit: 'px', format: [pageWidth, pageHeight], lineHeight: 1.5});

    let {width, height} = pdf.getPageSize();

    await drawTitle(pdf, data, width);

    let rect = {x: 0, y: TITLE_HEIGHT, w: GRID_WIDTH, h: height - TITLE_HEIGHT};
    pdf.drawBorder(rect, '#d1d1d1', dwPdf.Border.Right);
    rect.h = SCALE_HEIGHT;
    pdf.drawBorder(rect, '#d1d1d1', dwPdf.Border.Bottom);

    rect = pdf.rect(GRID_WIDTH, TITLE_HEIGHT, width - GRID_WIDTH, SCALE_HEIGHT);
    pdf.drawBorder(rect, '#d1d1d1', dwPdf.Border.Bottom);
    rect.y += LINE_HEIGHT;
    pdf.drawBorder(rect, '#d1d1d1', dwPdf.Border.Top);

    let topScaleRect = {x: GRID_WIDTH, y: TITLE_HEIGHT, w: SCALE_WIDTH, h: LINE_HEIGHT};
    rect = {x: GRID_WIDTH, y: TITLE_HEIGHT + LINE_HEIGHT, w: SCALE_WIDTH, h: height - (TITLE_HEIGHT + LINE_HEIGHT)};

    let date = new Date(data.startDate);
    for (let i = 0; i < data.dayCount; i++) {
      let scaleRect = pdf.cloneRect(rect);
      scaleRect.h = LINE_HEIGHT;

      if (date.getDay() === 0 || date.getDay() === 6) {
        pdf.fillRect({x: rect.x + 1, y: rect.y + LINE_HEIGHT, w: rect.w - 1, h: rect.h - LINE_HEIGHT}, '#f9f9f9');
        pdf.fillRect(scaleRect, '#a3a3a3');
        pdf.drawBorder(rect, '#d1d1d1', dwPdf.Border.Right);
        pdf.drawText(`${date.getDate()}`, scaleRect, {
          fontName: "Montserrat-Regular", fontSize: 12, fontColor: '#ffffff', hAlign: 'center', vAlign: 'middle'
        });
      } else {
        pdf.drawBorder(rect, '#d1d1d1', dwPdf.Border.Right);
        pdf.drawText(`${date.getDate()}`, scaleRect, {
          fontName: "Montserrat-Regular", fontSize: 12, fontColor: '#464646', hAlign: 'center', vAlign: 'middle'
        });
      }

      if (date.getDate() === date.getDaysInMonth() || i + 1 === data.dayCount) {
        // next month or end of scale
        pdf.drawBorder(topScaleRect, '#d1d1d1', dwPdf.Border.Right);
        pdf.drawText(moment(date).format("MMMM YYYY"), topScaleRect, {
          fontName: "Montserrat-Regular", fontSize: 12, fontColor: '#464646', hAlign: 'center', vAlign: 'middle'
        });
        topScaleRect.x += topScaleRect.w;
        topScaleRect.w = SCALE_WIDTH;
      } else {
        topScaleRect.w += SCALE_WIDTH;
      }

      rect.x += SCALE_WIDTH;
      date.addDays(1);
    }

    drawGridTitle(pdf);

    rect = {x: 0, y: TITLE_HEIGHT + SCALE_HEIGHT, w: width, h: LINE_HEIGHT};
    for (let i = 0; i < data.tasks.length; i++) {
      await drawTask(pdf, data.tasks[i], rect, data);
    }

    pdf.save(fileName, {returnPromise: true});
  }

  async function drawTitle(pdf, data, width) {
    let rect = {x: 0, y: 0, w: width, h: TITLE_HEIGHT};
    pdf.fillRect(rect, '#464646');

    rect = {x: 0, y: 0, w: ICON_WIDTH, h: TITLE_HEIGHT};
    await pdf.drawImage(data.icon, rect, {fit: false, scale: 0.41});

    rect = {x: ICON_WIDTH, y: 0, w: width - TITLE_HEIGHT, h: TITLE_HEIGHT};
    pdf.drawText(data.logo, rect, {
      fontName: "Inter-SemiBold", fontSize: 25, fontColor: '#ffffff', hAlign: 'left', vAlign: 'middle'
    });

    rect = {x: 0, y: 0, w: width, h: TITLE_HEIGHT};
    pdf.drawText(data.title, rect, {
      fontName: "Inter-Black", fontSize: 25, fontColor: '#ffffff', hAlign: 'center', vAlign: 'middle'
    });
  }

  function drawGridTitle(pdf) {
    let rect = {x: 10, y: TITLE_HEIGHT, w: TASK_WBS_WIDTH, h: SCALE_HEIGHT};
    pdf.drawText("#", rect, {
      fontName: "Montserrat-SemiBold", fontSize: 12, fontColor: '#464646', hAlign: 'left', vAlign: 'middle'
    });

    rect.x += rect.w;
    rect.w = TASK_TEXT_WIDTH;
    pdf.drawText("Title", rect, {
      fontName: "Montserrat-SemiBold", fontSize: 12, fontColor: '#464646', hAlign: 'center', vAlign: 'middle'
    });

    rect.x += rect.w;
    rect.w = TASK_DATE_WIDTH;
    pdf.drawText("Start Date", rect, {
      fontName: "Montserrat-SemiBold", fontSize: 12, fontColor: '#464646', hAlign: 'center', vAlign: 'middle'
    });

    rect.x += rect.w;
    rect.w = TASK_DATE_WIDTH;
    pdf.drawText("End Date", rect, {
      fontName: "Montserrat-SemiBold", fontSize: 12, fontColor: '#464646', hAlign: 'center', vAlign: 'middle'
    });

    rect.x += rect.w;
    rect.w = TASK_STATUS_WIDTH;
    pdf.drawText("Status", rect, {
      fontName: "Montserrat-SemiBold", fontSize: 12, fontColor: '#464646', hAlign: 'center', vAlign: 'middle'
    });

    rect.x += rect.w;
    rect.w = TASK_PERCENT_WIDTH;
    pdf.drawText("Percent Complete", rect, {
      fontName: "Montserrat-SemiBold", fontSize: 12, fontColor: '#464646', hAlign: 'center', vAlign: 'middle'
    });

    rect.x += rect.w;
    rect.w = TASK_DAYS_WIDTH;
    pdf.drawText("Working Days", rect, {
      fontName: "Montserrat-SemiBold", fontSize: 12, fontColor: '#464646', hAlign: 'center', vAlign: 'middle'
    });
  }

  async function drawTask(pdf, task, rect, data) {
    let fontName = task.children ? "Montserrat-SemiBold" : "Montserrat-Regular";

    pdf.drawBorder(rect, '#d1d1d1', dwPdf.Border.Bottom);

    let cellRect = pdf.cloneRect(rect);
    cellRect.x += 10;
    cellRect.w = TASK_WBS_WIDTH;
    pdf.drawText(task.wbs, cellRect, {
      fontName: fontName, fontSize: 12, fontColor: '#464646', hAlign: 'left', vAlign: 'middle'
    });

    cellRect.x += cellRect.w;
    cellRect.w = TASK_TEXT_WIDTH;
    pdf.drawText(task.text, cellRect, {
      fontName: fontName, fontSize: 12, fontColor: '#464646', hAlign: 'left', vAlign: 'middle'
    });

    cellRect.x += cellRect.w;
    cellRect.w = TASK_DATE_WIDTH;
    pdf.drawText(moment(task.startDate).format("D MMM, YYYY"), cellRect, {
      fontName: fontName, fontSize: 12, fontColor: '#464646', hAlign: 'left', vAlign: 'middle'
    });

    cellRect.x += cellRect.w;
    cellRect.w = TASK_DATE_WIDTH;
    pdf.drawText(moment(task.endDate).format("D MMM, YYYY"), cellRect, {
      fontName: fontName, fontSize: 12, fontColor: '#464646', hAlign: 'left', vAlign: 'middle'
    });

    cellRect.x += cellRect.w;
    cellRect.w = TASK_STATUS_WIDTH;
    await pdf.drawImage(task.status, cellRect, {fit: false, scale: 0.25});

    cellRect.x += cellRect.w;
    cellRect.w = TASK_PERCENT_WIDTH;
    pdf.drawText(`${task.progress}%`, cellRect, {
      fontName: fontName, fontSize: 12, fontColor: '#464646', hAlign: 'center', vAlign: 'middle'
    });

    cellRect.x += cellRect.w;
    cellRect.w = TASK_DAYS_WIDTH;
    pdf.drawText(`${formatNumber(task.duration, 0, 'en')}`, cellRect, {
      fontName: fontName, fontSize: 12, fontColor: '#464646', hAlign: 'center', vAlign: 'middle'
    });

    let taskRect = getRectByDate(pdf, pdf.rect(rect.x + GRID_WIDTH, rect.y + 5, rect.w - GRID_WIDTH, rect.h - 10),
      task.startDate, task.endDate, data.startDate, data.endDate);

    if (task.isProject) {
      let taskWidth = taskRect.w;
      taskRect.h = 3;
      pdf.fillRect(taskRect, '#083C55');
      taskRect.y += 3; taskRect.w = 7; taskRect.h = 7;
      pdf.fillTriangle(taskRect, '#083C55', dwPdf.Triangle.TopLeft);
      taskRect.x = taskRect.x + taskWidth - 7;
      pdf.fillTriangle(taskRect, '#083C55', dwPdf.Triangle.TopRight);
    } else {
      pdf.drawRect(taskRect, TASK_COLORS[task.style], '#464646', 8);

      pdf.drawText(task.text, taskRect, {
        fontName: 'Montserrat-Regular', fontSize: 12, fontColor: '#ffffff', hAlign: 'left', vAlign: 'middle', padding: 4
      });
    }

    rect.y += LINE_HEIGHT;

    if (task.children) {
      task.children.forEach(child => drawTask(pdf, child, rect));
    }
  }

  function getRectByDate(pdf, rect, start, end, totalStart, totalEnd) {
    let totalDuration = (totalEnd.getTime() - totalStart.getTime());
    if (totalDuration === 0) {
      return pdf.cloneRect(rect);
    }

    return pdf.rect(
      (start.getTime() - totalStart.getTime()) / totalDuration * rect.w + rect.x,
      rect.y,
      (end.getTime() - start.getTime()) / totalDuration * rect.w,
      rect.h
    );
  }

  function number(x) {
    return isFinite(x) ? x : 0;
  }

  function formatNumber(number, place, locale) {
    if (!isFinite(number)) {
      return '';
    }

    if (locale === 'eu') {
      let data = Number(number).toFixed(place);
      let ret = data ? data.replace(".", ",") : 0;
      let NO = ret.split(",");
      let result = NO[0];
      let change = result.replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1.");
      ret = change + "," + NO[1];
      return ret;
    } else {
      return Math.round(number * Math.pow(10, place)) / Math.pow(10, place);
    }
  }
}