/**
 * Example of the integration of displaying tiny histograms over a map.
 * Copyright (c) 2016 favero - The MIT License (MIT)
 */

$(document).ready(function () {
  var BASE = 8;
  var MAX_HEIGHT = 100;

  var tooltip = $('div#tooltip');
  tooltip.hide();
  var visible = false;
  var colorScale = chroma
      .scale(['#D5E3FF', '#003171'])
      .domain([0, 1]);
  var colorScale2 = chroma
      .scale(['#FFFFFF', 'RED'])
      .domain([0, 1]);

  var map = null;
  var topoLayer = null;
  var countryPoints = null;
  var gdpData = null;
  var publicDeptData = null;
  var giniData = null;
  var co2Data = null;
  var overGroupLeaflet = null;
  var allCharts = [];
  var chartNodeForCountry = null;

  var dsv = d3.dsv(',', 'text/plain');

  var createMap = function () {
    // create a map object and set the view to the coordinates 44,-31 with a zoom of 10
    map = L.map('map1',
        {
          minZoom: 2,
          maxZoom: 5
        }).setView([44, -31], 3);

    topoLayer = new L.TopoJSON(null, {style: function (feature) {
        var fillColor = colorScale(0).hex();
        var value = 0;
        if (feature.properties.ISO_A3) {
          if (feature.properties.ISO_A3 && gdpData[feature.properties.ISO_A3]) {
            value = gdpData[feature.properties.ISO_A3]["2014"];
            if (value > 40000)
              fillColor = colorScale(1).hex();
            else if (value > 30000)
              fillColor = colorScale(0.8).hex();
            else if (value > 20000)
              fillColor = colorScale(0.6).hex();
            else if (value > 10000)
              fillColor = colorScale(0.4).hex();
            else
              fillColor = colorScale(0.2).hex();
          }
        }
        return {color: "#eee", weight: 1, fillColor: fillColor, width: 2, fillOpacity: 1};
      },
      onEachFeature: function (feature, layer) {
        layer.on({
          'mouseover': mouseOverStateHandler,
          'mouseout': mouseOutStateHandler
        });
      }
    });
  };
  var requestData = function () {
    
    //call all ajax requests
    $.when(addCountriesJson(),
        addCountryPointsJson(),
        addGdpDataJson(),
        addPublicDeptDataJson(),
        addGiniDataJson(),
        addCo2DataJson()
        ).done(function (data1, data2, data3, data4, data5, data6) {
      
      var points = dsv.parse(data2[0]).map(function (d) {
        
        return {
          code: d.ISO_A3,
          lng: +d.X,
          lat: +d.Y
        };
      });
      
      countryPoints = [];
      points.forEach(function (el) {
        countryPoints[el.code] = [el.lat, el.lng];
      });
      gdpData = data3[0];
      publicDeptData = data4[0];
      giniData = data5[0];
      co2Data = data6[0];
      topoData = data1[0];
      addDataOnMap();
      $('.leaflet-clickable').css('cursor', 'default');
    });
  };
  var mouseOverStateHandler = function () {
    if (this.feature.properties) {
      visible = true;
      var value = 'NN';
      if (this.feature.properties.ISO_A3 && gdpData[this.feature.properties.ISO_A3])
        value = parseInt(gdpData[this.feature.properties.ISO_A3]["2014"]);
      tooltip.text(this.feature.properties.BRK_NAME + ": " + (!isNaN(value) ? value.format() + ' $' : value));
      tooltip.show();
    }
  };
  var mouseOutStateHandler = function () {
    visible = false;
    tooltip.hide();
  };
  var addDataOnMap = function () {
    topoLayer.addTo(map);
    topoLayer.addData(topoData);

    createListOfChart();
    addLegend();
    map.on("viewreset", updateChartsAtZoomChange);

    map.on('mousemove', function (e) {
      if (visible)
        tooltip.css({top: (e.containerPoint.y - 30) + "px", left: e.containerPoint.x + "px"});
    });
  };

  var addCountriesJson = function (data) {
    return $.getJSON('data/worldMap/ne_110m_admin_0_countries_v3.topo.json');
  };
  var addCountryPointsJson = function (data) {
    return $.ajax('data/worldMap/countryPoints.csv');
  };
  var addGdpDataJson = function (data) {
    return $.getJSON('data/worldMap/ny.gdp.pcap.cd_Indicator_en_csv_v3.json');
  };
  var addPublicDeptDataJson = function (data) {
    return $.getJSON('data/worldMap/publicDept.json');
  };
  var addGiniDataJson = function (data) {
    return $.getJSON('data/worldMap/gini_Indicator.json');
  };
  var addCo2DataJson = function (data) {
    return $.getJSON('data/worldMap/co2_Indicator.json');
  };
  var createListOfChart = function () {
    if (overGroupLeaflet === null) {
      overGroupLeaflet = d3.select('svg').append("g").attr("class", "leaflet-zoom-hide");
      for (var el in topoLayer._layers) {
        var f = topoLayer._layers[el];
        addChartToFeature(f.feature);
      }
    }
    chartNodeForCountry = overGroupLeaflet.selectAll("g.leaflet-chart>g").data(allCharts);

    chartNodeForCountry.enter().append("g")
        .attr("id", function (d) {
          return 'single-chart-' + d.id;
        });
    drawAllChartsInLeaflet(overGroupLeaflet);
  };

  var addChartToFeature = function (feature) {
    var d = publicDeptData[feature.properties.BRK_NAME.toUpperCase()];
    var g = giniData[feature.properties.ISO_A3];
    var c = co2Data[feature.properties.ISO_A3];
    if (g === undefined || g.gini === "") {
      g = {gini: null};
    }
    if (c === undefined) {
      c = {co2: null};
    }
    var coord = countryPoints[feature.properties.ISO_A3]
    allCharts.push({
      id: feature.properties.ISO_A3,
      surface: feature.properties.SURFACE,
      els: {
        debt: d === undefined ? 0 : parseFloat(d.debt),
        gini: parseFloat(g.gini),
        co2: c.co2
      },
      country: feature.properties.BRK_NAME,
      feature: feature,
      coord: coord
    });
  };

  /* draw the chart direct in svg-component of the leaflet */
  var drawAllChartsInLeaflet = function (group) {
    chartNodeForCountry.attr("transform", function (d) {
      var xy = map.latLngToLayerPoint(d.coord);
      return "translate(" + (xy.x + (-1 * BASE)) + "," + xy.y + ")";
    });

    var zoom = map.getZoom();
    chartNodeForCountry.each(function (d) {
      var _this = d3.select(this);
      _this.selectAll('*').remove();
      if ((zoom === 2 && d.surface > 100)
          || (zoom === 3 && d.surface > 60)
          || (zoom === 4 && d.surface > 30)
          || zoom === 5 && d.surface > 3) {
        var debtNorm = null;
        var debtFill = null;
        if (d.els.debt !== null || d.els.debt !== '') {
          debtNorm = d.els.debt / 230;
          debtFill = colorScale2(debtNorm).hex();
        }
        var giniNorm = null;
        var giniFill = null;
        if (d.els.gini !== null || d.els.gini !== '') {
          giniNorm = d.els.gini / 65;
          giniFill = colorScale2(giniNorm).hex();
        }
        var co2Norm = null;
        var co2Fill = null;
        if (d.els.co2 !== null || d.els.co2 !== '') {
          co2Norm = d.els.co2 / 28;
          co2Fill = colorScale2(co2Norm).hex();
        };

        addRect(_this, d, 0, d.els.debt, debtNorm, debtFill, 'Debt of ' + d.country);
        addRect(_this, d, 1, d.els.gini, giniNorm, giniFill, 'Gini of ' + d.country);
        addRect(_this, d, 2, d.els.co2, co2Norm, co2Fill, 'CO2 of ' + d.country);
      } else if (zoom === 2 && d.surface > 40) {
        addIcon(_this, d.country);
      } else if (zoom > 2 && d.surface > 3) {
        addIcon(_this, d.country);
      }
    });
  };

  var addIcon = function (el, label) {
    el.append("svg:image")
        .attr("xlink:href", "img/diagram-icon.png")
        .attr('class', 'diagram-icon')
        .style("opacity", "0.75")
        .attr("x", "-12")
        .attr("y", "-12")
        .attr("width", "25")
        .attr("height", "25")
        .on("mouseover", function () {
          d3.select(this).style("opacity", "1");
          visible = true;
          tooltip.html(label + ', zoom in to see chart');
          tooltip.show();
        })
        .on("mouseout", function () {
          d3.select(this).style("opacity", "0.75");
          tooltip.hide();
        });
    ;
  };

  var addRect = function (el, d, index, value, norm, fill, label) {
    var rect = el.append("rect")
        .attr("data-count", index)
        .attr("x", (index * BASE))
        .attr("width", BASE);

    if (!norm) {
      rect.attr("y", -0.3 * MAX_HEIGHT)
          .attr("height", 0.3 * MAX_HEIGHT)
          .attr("class", 'rect-base-null')
          .on("mouseover", function () {
            d3.select(this).style("fill", "yellow");
            visible = true;
            tooltip.html(label + ': NN');
            tooltip.show();
          })
          .on("mouseout", function () {
            d3.select(this).style("fill", 'transparent');
            tooltip.hide();
          });
    } else {
      rect.attr("y", -norm * MAX_HEIGHT)
          .attr("height", norm * MAX_HEIGHT)
          .attr("class", 'rect-base')
          .style("fill", fill)
          .on("mouseover", function () {
            d3.select(this).style("fill", "yellow");
            visible = true;
            tooltip.html(label + ': ' + Math.round(value * 100) / 100 + (index === 0 ? '%' : ''));
            tooltip.show();
          })
          .on("mouseout", function () {
            d3.select(this).style("fill", fill);
            tooltip.hide();
          });
    }
  };

  var addLegend = function () {
    var els = [{label: 'debt', value: 40, count: 0}, {label: 'gini', value: 80, count: 1}, 
      {label: 'co2', value: 20, count: 2}];
    var l = d3.select('div#legend-chart').append("svg").append("g");
    l.selectAll('rect').data(els).enter().append("rect")
        .attr("x", function (d) {
          return d.count * BASE * 2;
        })
        .attr("y", function (d) {
          return  -d.value + 85;
        })
        .attr("height", function (d) {
          return d.value;
        })
        .attr("width", BASE * 2)
        .attr("stroke", '#aaa')
        .style("fill", '#fff');

    l.selectAll('text').data(els).enter().append("text")
        .attr("x", function (d) {
          return (d.count * BASE * 2) + 6;
        })
        .attr("y", function (d) {
          return 84;
        })
        .attr("dy", ".35em")
        .text(function (d) {
          return d.label;
        });
  };

  var updateChartsAtZoomChange = function () {
    drawAllChartsInLeaflet(overGroupLeaflet);
  };

  //start -------------------------
  createMap();
  requestData();
});

/**
 * Number.prototype.format(n, x)
 * 
 * @param integer n: length of decimal
 * @param integer x: length of sections
 */
Number.prototype.format = function (n, x) {
  var re = '\\d(?=(\\d{' + (x || 3) + '})+' + (n > 0 ? '\\.' : '$') + ')';
  return this.toFixed(Math.max(0, ~~n)).replace(new RegExp(re, 'g'), '$&,');
};

L.TopoJSON = L.GeoJSON.extend({
  addData: function (jsonData) {
    if (jsonData.type === "Topology") {
      for (key in jsonData.objects) {
        geojson = topojson.feature(jsonData, jsonData.objects[key]);
        L.GeoJSON.prototype.addData.call(this, geojson);
      }
    }
    else {
      L.GeoJSON.prototype.addData.call(this, jsonData);
    }
  }
});
