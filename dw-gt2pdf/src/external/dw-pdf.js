function dwPdf(options) {

  const self = this;

  this.pdf = new jspdf.jsPDF(options);

  this.getPageSize = function () {
    let width = this.pdf.internal.pageSize.getWidth();
    let height = this.pdf.internal.pageSize.getHeight();
    return {width, height};
  }

  this.drawText = function (text, rect, options) {
    if (options.fontName) {
      this.pdf.setFont(options.fontName, 'normal');
    }

    if (options.fontSize) {
      this.pdf.setFontSize(options.fontSize);
    }

    if (options.fontColor !== undefined) {
      this.pdf.setTextColor(options.fontColor);
    }

    let padding = 0;
    if (options.padding !== undefined) {
      padding = options.padding;
    }

    let x = rect.x;
    let y;
    if (options.hAlign === 'center') {
      x += rect.w / 2;
    } else if (options.hAlign === 'right') {
      x += rect.w - padding;
    } else {
      x += padding;
    }

    if (options.vAlign === 'middle') {
      y = rect.y + rect.h / 2 + this.pdf.getFontSize() / 4;
    } else if (options.vAlign === 'bottom') {
      y = rect.y + rect.h - padding;
    } else {
      y = this.pdf.getFontSize() * this.pdf.getLineHeightFactor() + padding;
    }

    this.pdf.text(x, y, `${text}`, {
      align: options.hAlign,
      baseline: options.vAlign,
      maxWidth: rect.w - padding * 2
    });
  }

  this.drawSvg = function (src, rect) {
    return new Promise((resolve, reject) => {
      fetch(src)
        .then(response => response.text())
        .then(svg => {
          self.pdf.addSvgAsImage(svg, rect.x, rect.y, rect.w, rect.h)
            .then(resolve)
            .catch(reject);
        })
        .catch(reject);
    });
  }

  this.drawImage = function (src, rect, option) {
    return new Promise((resolve, reject) => {
      let image = new Image();
      image.onload = function () {
        if (option.fit) {
          let result = getSizeToFit(this.width, this.height, rect.w, rect.h);
          self.pdf.addImage(image, "PNG", rect.x, rect.y + result.y, result.w, result.h);
        } else {
          let w = this.width, h = this.height;
          if (option.scale !== undefined) {
            w *= option.scale;
            h *= option.scale;
          }
          self.pdf.addImage(image, "PNG", rect.x + (rect.w - w) / 2, rect.y + (rect.h - h) / 2, w, h);
        }
        resolve();
      };
      image.onerror = function (e) {
        reject(e);
      }
      image.src = src;
    });
  }

  this.drawRect = function (rect, fillColor, borderColor, borderRadius) {
    this.pdf.setFillColor(fillColor);
    this.pdf.roundedRect(rect.x, rect.y, rect.w, rect.h, borderRadius, borderRadius, 'F');
    this.pdf.setDrawColor(borderColor);
    this.pdf.roundedRect(rect.x, rect.y, rect.w, rect.h, borderRadius, borderRadius, 'S');
  }

  this.fillRect = function (rect, fillColor) {
    this.pdf.setFillColor(fillColor);
    this.pdf.rect(rect.x, rect.y, rect.w, rect.h, 'F');
  }

  this.drawBorder = function (rect, color, option) {
    this.pdf.setDrawColor(color);

    if ((option & dwPdf.Border.Left) !== 0) {
      this.pdf.line(rect.x, rect.y, rect.x, rect.y + rect.h, 'S');
    }

    if ((option & dwPdf.Border.Right) !== 0) {
      this.pdf.line(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h, 'S');
    }

    if ((option & dwPdf.Border.Top) !== 0) {
      this.pdf.line(rect.x, rect.y, rect.x + rect.w, rect.y, 'S');
    }

    if ((option & dwPdf.Border.Bottom) !== 0) {
      this.pdf.line(rect.x, rect.y + rect.h, rect.x + rect.w, rect.y + rect.h, 'S');
    }
  }

  this.drawLine = function (pt1, pt2, color) {
    this.pdf.setDrawColor(color);
    this.pdf.line(pt1.x, pt1.y, pt2.x, pt2.y, 'S');
  }

  this.fillTriangle = function (rect, fillColor, option) {
    this.pdf.setFillColor(fillColor);
    if (option === dwPdf.Triangle.TopLeft) {
      this.pdf.triangle(rect.x - 0.05, rect.y, rect.x + rect.w, rect.y, rect.x - 0.05, rect.y + rect.h, 'F');
    } else if (option === dwPdf.Triangle.TopRight) {
      this.pdf.triangle(rect.x, rect.y, rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h, 'F');
    }
  }

  this.rect = function (x, y, w, h) {
    return {x, y, w, h};
  }

  this.rect2 = function (l, t, r, b) {
    return {x: l, y: t, w: r - l, h: b - t};
  }

  this.cloneRect = function (rect) {
    return {
      x: rect.x, y: rect.y, w: rect.w, h: rect.h
    };
  }

  this.save = function (fileName) {
    this.pdf.save(fileName + ".pdf");
  }

  function hex2rgb(hex) {
    return {
      r: '0x'+hex[1]+hex[2] | 0,
      g: '0x'+hex[3]+hex[4] | 0,
      b: '0x'+hex[5]+hex[6] | 0
    };
  }

  function getSizeToFit(currentWidth, currentHeight, desiredWidth, desiredHeight) {
    let currentRatio = currentWidth / currentHeight;
    let targetRatio = desiredWidth / desiredHeight;
    let w = desiredWidth;
    let h = desiredHeight;

    let x = 0;
    let y = 0;
    if (currentRatio > targetRatio) {
      h = desiredWidth / currentRatio;
      y = (desiredHeight - h) / 2;
    } else if (currentRatio < targetRatio) {
      w = desiredHeight * currentRatio;
      x = (desiredWidth - w) / 2;
    }

    return {x, y, w, h};
  }
}

dwPdf.Border = {
  Left: 1,
  Right: 2,
  Top: 4,
  Bottom: 8,
  All: 15
}

dwPdf.Triangle = {
  TopLeft: 1,
  TopRight: 2
}
