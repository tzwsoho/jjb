// 京价保
var observeDOM = (function () {
  var MutationObserver = window.MutationObserver || window.WebKitMutationObserver,
    eventListenerSupported = window.addEventListener;

  return function (obj, callback) {
    if (MutationObserver) {
      // define a new observer
      var obs = new MutationObserver(function (mutations, observer) {
        if (mutations[0].addedNodes.length || mutations[0].removedNodes.length)
          callback();
      });
      // have the observer observe foo for changes in children
      obs.observe(obj, { childList: true, subtree: true });
    }
    else if (eventListenerSupported) {
      obj.addEventListener('DOMNodeInserted', callback, false);
      obj.addEventListener('DOMNodeRemoved', callback, false);
    }
  };
})();

function priceFormatter(price) {
  return Number(Number(price).toFixed(2))
}

function injectScript(file, node) {
  var th = document.getElementsByTagName(node)[0];
  var s = document.createElement('script');
  s.setAttribute('type', 'text/javascript');
  s.setAttribute('charset', "UTF-8");
  s.setAttribute('src', file);
  th.appendChild(s);
}

function injectScriptCode(code, node) {
  var th = document.getElementsByTagName(node)[0];
  var script = document.createElement('script');
  script.setAttribute('type', 'text/javascript');
  script.setAttribute('language', 'JavaScript');
  script.textContent = code;
  th.appendChild(script);
}

injectScriptCode(`
  if (typeof hrl != 'undefined' && typeof host != 'undefined') {
    document.write('<a style="display:none" href="' + hrl + '" id="exe"></a>');
    document.getElementById('exe').click()
  }
`, 'body')

function escapeSpecialChars(jsonString) {
  return jsonString.replace(/\\n/g, "\\n").replace(/\\'/g, "\\'").replace(/\\"/g, '\\"').replace(/\\&/g, "\\&").replace(/\\r/g, "\\r").replace(/\\t/g, "\\t").replace(/\\b/g, "\\b").replace(/\\f/g, "\\f");
}

async function fetchProductPage(sku) {
  var resp = await fetch('https://item.m.jd.com/product/' + sku + '.html', {
    cache: 'no-cache'
  })
  var page = await resp.text()
  if ($(page)[0] && $(page)[0].id == 'returnurl') {
    var url = $(page)[0].value.replace("http://", "https://")
    var request = new XMLHttpRequest();
    request.open('GET', url, false);
    request.send(null);

    if (request.status === 200) {
      var newData = request.responseText
      request.abort();
      return newData
    } else {
      request.abort();
      throw new Error('GET Error')
    }
  } else {
    return page
  }
}

// 单个商品价保申请
async function dealProduct(product, order_info, setting) {
  let success_logs = []
  let product_name = product.find('.p-name a').text() || product.find('.item-name .name').text()
  let orderPriceDom = product.find('.price-count .price').text() ? product.find('.price-count .price') : product.find('.item-opt .price')
  let order_price = Number(orderPriceDom.text().replace(/[^0-9\.-]+/g, ""))

  let applyBtn = product.find('.item-opt .apply').text() ? product.find('.item-opt .apply') : product.find('.btn a')
  let orderId = applyBtn.attr('id').split('_')

  let orderCountDom = product.find('.price-count .count').text() ? product.find('.price-count .count') : product.find('.item-name .count')
  let order_quantity =  Number(orderCountDom.text().trim().replace(/[^0-9\.-]+/g, ""))

  let order_success_logs = product.find('.show-detail').text() ? product.find('.show-detail td') : product.next().next().find('.jb-has-succ')

  let product_img = product.find('a img').attr('src') ? product.find('a img').attr('src') : product.find('.img img').attr('src')

  if (order_price < 0.01) {
    return console.log('忽略免费的商品')
  }

  console.log('发现有效的订单：', product_name, " 下单价格：", order_price)

  if (order_success_logs && order_success_logs.length > 0) {
    order_success_logs.each(function() {
      let log = $(this).text().trim().replace('查看退款详情','').replace('查看申请记录','')
      if (log && log.indexOf("成功") > -1) {
        success_logs.push(log)
      }
    });
  }
  // 请求价格
  chrome.runtime.sendMessage({
    action: "getProductPrice",
    sku: orderId[2],
    setting: setting
  }, function(response) {
    console.log("getProductPrice Response: ", response);
  });

  order_info.goods.push({
    sku: orderId[2],
    name: product_name,
    img: product_img,
    order_price: order_price,
    success_log: success_logs,
    quantity: order_quantity
  })
  // 记录订单信息
  applyBtn.addClass('applyBtn')
  applyBtn.attr('sku', orderId[2])
  applyBtn.attr('order_price', order_price)
  applyBtn.attr('product_name', product_name)
}

// 申请价保
function apply(applyBtn, priceInfo, setting) {
  let order_price = applyBtn.attr('order_price')
  let product_name = applyBtn.attr('product_name')
  let applyId = applyBtn.attr('id')
  // 获取上次申请价保的价格
  getSetting('last_apply_price' + applyId, (lastApply) => {
    let lastApplyPrice = lastApply ? lastApply.price : localStorage.getItem('jjb_order_' + applyId)
    if (priceInfo.price > 0 && priceInfo.price < order_price && (order_price - priceInfo.price) > setting.pro_min ) {
      if (lastApplyPrice && Number(lastApplyPrice) <= priceInfo.price) {
        console.log('Pass: ' + product_name + '当前价格上次已经申请过了:', priceInfo.price, ' Vs ', lastApplyPrice)
        return
      }
      // 如果禁止了自动申请
      if (setting.prompt_only) {
        localStorage.setItem('jjb_order_' + applyId, priceInfo.price)
        chrome.runtime.sendMessage({
          action: "setVariable",
          key: 'last_apply_price' + applyId,
          value: {
            price: priceInfo.price,
            submitted: false,
            time: new Date()
          }
        }, function (response) {
          console.log("Response: ", response);
        });
        chrome.runtime.sendMessage({
          text: "notice",
          batch: 'jiabao',
          title: '报告老板，发现价格保护机会！',
          product_name: product_name,
          content: '购买价：'+ order_price + ' 现价：' + priceInfo.price + '，请手动提交价保申请。'
        }, function(response) {
          console.log("Response: ", response);
        });
      } else {
        // 申请
        applyBtn.trigger( "click" )
        localStorage.setItem('jjb_order_' + applyId, priceInfo.price)
        chrome.runtime.sendMessage({
          action: "setVariable",
          key: 'last_apply_price' + applyId,
          value: {
            price: priceInfo.price,
            submitted: true,
            time: new Date()
          }
        }, function (response) {
          console.log("Response: ", response);
        });
        chrome.runtime.sendMessage({
          text: "notice",
          batch: 'jiabao',
          title: '报告老板，发现价格保护机会！',
          product_name: product_name,
          content: '购买价：'+ order_price + ' 现价：' + priceInfo.price + '，已经自动提交价保申请，正在等待申请结果。'
        }, function(response) {
          console.log("Response: ", response);
        });
        // 等待申请结果
        var resultId = "applyResult_" + applyId.substr(8)
        observeDOM(document.getElementById(resultId), function () {
          let resultText = $("#" + resultId).text()
          if (resultText && resultText.indexOf("预计") < 0 && resultText.indexOf("繁忙") < 0) {
            chrome.runtime.sendMessage({
              batch: 'jiabao',
              text: "notice",
              title: "报告老板，价保申请有结果了",
              product_name: product_name,
              content: "价保结果：" + resultText
            }, function (response) {
              console.log("Response: ", response);
            });
          }
        });
      }
    }
  });
}

// 提取价格信息
function seekPriceInfo(platform) {
  let urlInfo, sku, price, normal_price, presale_price, plus_price, pingou_price, spec_price, orgin_price, earnest_price, skuName
  if (platform == 'pc') {
    urlInfo = /(https|http):\/\/item.jd.com\/([0-9]*).html/g.exec(window.location.href);
    skuName = $(".sku-name").text() ? $(".sku-name").text().trim() : null
    sku = urlInfo[2]
    // 需要对预售定金进行区分
    if ($('span.p-price').length > 1) {
      $('span.p-price').each(function (priceDom) {
        if ($(priceDom).hasClass('J-earnest')) {
          earnest_price = $(priceDom).find('.price').text() ? $(priceDom).find('.price').text().replace(/[^0-9\.-]+/g, "") : null
        } else {
          normal_price = $(priceDom).find('.price').text() ? $(priceDom).find('.price').text().replace(/[^0-9\.-]+/g, "") : null
        }
      })
    } else {
      normal_price = ($('span.p-price .price').text() ? $('span.p-price .price').text().replace(/[^0-9\.-]+/g, "") : null) || ($('#jd-price').text() ? $('#jd-price').text().replace(/[^0-9\.-]+/g, "") : null)
    }

    presale_price = $('.J-presale-price').text() ? $('.J-presale-price').text() : null

    plus_price = $('.p-price-plus .price').text() ? $('.p-price-plus .price').text().replace(/[^0-9\.-]+/g, "") : null
    pingou_price = null
    if ($('#pingou-banner-new') && $('#pingou-banner-new').length > 0 && ($('#pingou-banner-new').css('display') !== 'none')) {
      pingou_price = ($(".btn-pingou span").first().text() ? $(".btn-pingou span").first().text().replace(/[^0-9\.-]+/g, "") : null) || normal_price
      normal_price = $("#InitCartUrl span").text() ? $("#InitCartUrl span").text().replace(/[^0-9\.-]+/g, "") : price
    }
    price = normal_price || presale_price
  } else {
    urlInfo = /(https|http):\/\/item.m.jd.com\/product\/([0-9]*).html/g.exec(window.location.href);
    sku = urlInfo[2]
    skuName = $("#itemName").text() ? $("#itemName").text().trim() : null

    normal_price =($('#priceSaleChoice').text() ? $('#priceSaleChoice').text().replace(/[^0-9\.-]+/g, "") : null) || $('#jdPrice').val() || ($('#specJdPrice').text() ? $('#specJdPrice').text().replace(/[^0-9\.-]+/g, "") : null)

    spec_price = ($('#priceSale').text() && $('#priceSale').height() > 0 ? $('#priceSale').text().replace(/[^0-9\.-]+/g, "") : null) || $('#spec_price').text() && $('#spec_price').height() > 0|| ($('#specPrice').text() ? $('#specPrice').text().replace(/[^0-9\.-]+/g, "") : null)

    plus_price = ($('.vip_price #priceSaleChoice1').text() ? $('.vip_price #priceSaleChoice1').text().replace(/[^0-9\.-]+/g, "") : null) || $('#specPlusPrice').text()

    orgin_price = $("#orginBuyBtn span").text() ? $("#orginBuyBtn span").text().replace(/[^0-9\.-]+/g, "") : null || $("#ysOriPrice").text() ? $("#ysOriPrice").text().replace(/[^0-9\.-]+/g, "") : null

    price = normal_price || spec_price || orgin_price

    pingou_price = ($('#tuanDecoration .price_warp .price').text() ? $('#tuanDecoration .price_warp .price').text().replace(/[^0-9\.-]+/g, "") : null || null)
  }

  let priceInfo = {
    name: skuName,
    sku: sku,
    normal_price: price ? Number(price) : null,
    plus_price: plus_price ? Number(plus_price) : null,
    pingou_price: pingou_price? Number(pingou_price) : null
  }

  console.log(platform, priceInfo)

  // 通知价格
  chrome.runtime.sendMessage({
    action: 'productPrice',
    ...priceInfo
  }, function (response) {
    console.log("productPrice Response: ", response);
  });

  return priceInfo
}

// 查找订单并对比
function findOrderBySkuAndApply(priceInfo, setting) {
  console.log('findOrderBySkuAndApply', priceInfo)
  $( ".applyBtn" ).each(function() {
    let skuid = $(this).attr('sku')
    if (skuid && skuid == priceInfo.sku) {
      apply($(this), priceInfo, setting)
    }
  });
}

async function dealOrder(order, orders, setting) {
  let dealgoods = []
  let order_time = order.find('.tr-th span.time').text() ? new Date(order.find('.tr-th span.time').text()) : new Date(order.find('.title span').last().text().trim().split('：')[1])
  let order_id = order.find('.tr-th span.order').text() ? order.find('.tr-th span.order').text().replace(/[^0-9\.-]+/g, "") : order.find('.title .order-code').text().trim().split('：')[1]

  console.log('订单:', order_id, order_time, setting)

  let proTime = 15 * 24 * 3600 * 1000
  if (setting.pro_days == '7') {
    proTime = 7 * 24 * 3600 * 1000
  }
  if (setting.pro_days == '30') {
    proTime = 30 * 24 * 3600 * 1000
  }

  // 如果订单时间在设置的价保监控范围以内
  if (new Date().getTime() - order_time.getTime() < proTime) {
    var order_info = {
      time: order_time,
      id: order_id,
      goods: []
    }

    let productList = order.find('.product-item').length > 0 ? order.find('.product-item') : order.filter( ".co-th" )

    productList.each(function() {
      dealgoods.push(dealProduct($(this), order_info, setting))
    })
    await Promise.all(dealgoods)

    if (order_info.goods.length > 0) {
      orders.push(order_info)
    }
  }
}

async function getAllOrders(mode, setting) {
  console.log('京价保开始自动检查订单', mode)
  let orders = []
  let dealorders = []
  // 移动价保
  if ($( "#dataList0 li").length > 0) {
    $( "#dataList0 li").each(function() {
      dealorders.push(dealOrder($(this), orders, setting))
    });
  }
  // PC价保
  if ($( "#dataList .tr-th").length > 0) {
    $( "#dataList .tr-th").each(function() {
      let orderDom = $(this)
      let product = $(this).next()
      orderDom = orderDom.add(product)
      while (product.next().hasClass('co-th')) {
        orderDom = orderDom.add(product.next())
        product = product.next()
      }
      dealorders.push(dealOrder(orderDom, orders, setting))
    });
  }
  try {
    await Promise.all(dealorders)
  } catch (error) {
    console.error('dealorders', error)
  }
  chrome.runtime.sendMessage({
    text: "orders",
    content: JSON.stringify(orders)
  }, function(response) {
    console.log("Response: ", response);
  });
  localStorage.setItem('jjb_last_check', new Date().getTime());
}

function mockClick(element) {
  var dispatchMouseEvent = function (target, var_args) {
    var e = document.createEvent("MouseEvents");
    e.initEvent.apply(e, Array.prototype.slice.call(arguments, 1));
    target.dispatchEvent(e);
  };
  if (element) {
    dispatchMouseEvent(element, 'mouseover', true, true);
    dispatchMouseEvent(element, 'mousedown', true, true);
    dispatchMouseEvent(element, 'click', true, true);
    dispatchMouseEvent(element, 'mouseup', true, true);
  }
}

/* eventType is 'touchstart', 'touchmove', 'touchend'... */
function sendTouchEvent(x, y, element, eventType) {
  const touchObj = new Touch({
    identifier: Date.now(),
    target: element,
    clientX: x,
    clientY: y,
    radiusX: 2.5,
    radiusY: 2.5,
    rotationAngle: 10,
    force: 0.5,
  });

  if ('TouchEvent' in window && TouchEvent.length > 0) {
    const touchEvent = new TouchEvent(eventType, {
      cancelable: true,
      bubbles: true,
      touches: [touchObj],
      targetTouches: [],
      changedTouches: [touchObj],
      shiftKey: true,
    });
    element.dispatchEvent(touchEvent);
  } else {
    console.log('no TouchEvent')
  }

}

// 4：领取白条券
function CheckBaitiaoCouponDom(setting) {
  if (setting != 'never') {
    console.log('开始领取白条券')
    chrome.runtime.sendMessage({
      action: "run_status",
      mode: 'm',
      jobId: "4"
    })
    var time = 0;
    $("#react-root .react-root .react-view .react-view .react-view .react-view .react-view .react-view .react-view span").each(function () {
      let targetEle = $(this)
      if (targetEle.text() == '确定') {
        console.log('需要登录')
        simulateClick(targetEle)
      }
      if (targetEle.text() == '立即领取') {
        let couponDetails = targetEle.parent().prev().find('span').toArray()
        var coupon_name = couponDetails[2] ? $(couponDetails[2]).text().trim() : '未知白条券'
        var coupon_price = couponDetails[0] ? $(couponDetails[0]).text().trim(): '？' + (couponDetails[1] ? (' (' + $(couponDetails[1]).text() + ')') : '')
        setTimeout(function () {
          simulateClick(targetEle)
          setTimeout(function () {
            if (targetEle.text() == '去查看') {
              chrome.runtime.sendMessage({
                text: "coupon",
                title: "京价保自动领到一张白条优惠券",
                content: JSON.stringify({
                  batch: 'baitiao',
                  price: coupon_price,
                  name: coupon_name
                })
              }, function (response) {
                console.log("Response: ", response);
              });
            }
          }, 500)
        }, time)
        time += 5000;
      }
    })
  }
}


// 3：领取 PLUS 券
function getPlusCoupon(setting) {
  if (setting != 'never') {
    var time = 0;
    console.log('开始领取 PLUS 券')
    chrome.runtime.sendMessage({
      text: "run_status",
      jobId: "3"
    })
    $(".coupon-swiper .coupon-item").each(function () {
      var that = $(this)
      if ($(this).find('.get-btn').text() == '立即领取') {
        var coupon_name = that.find('.pin-lmt').text()
        var coupon_price = that.find('.cp-val').text() + '元 (' + that.find('.cp-lmt').text() + ')'
        setTimeout(function () {
          $(that).find('.get-btn').trigger("click")
          setTimeout(function () {
            if ($(that).find('.get-btn').text() == '去使用') {
              chrome.runtime.sendMessage({
                text: "coupon",
                title: "京价保自动领到一张 PLUS 优惠券",
                content: JSON.stringify({
                  id: '',
                  batch: '',
                  price: coupon_price,
                  name: coupon_name
                })
              }, function (response) {
                console.log("Response: ", response);
              });
            }
          }, time + 1500)
        }, time)
        time += 5000;
      }
    })
  }
}

// 15：领取全品类券
function getCommonUseCoupon(setting) {
  if (setting != 'never') {
    var time = 0;
    console.log('开始领取全品类券')
    weui.toast('京价保运行中', 1000);
    chrome.runtime.sendMessage({
      text: "run_status",
      jobId: "15"
    })
    $("#quanlist .quan-item").each(function () {
      var that = $(this)
      if (that.find('.q-ops-box .q-opbtns .txt').text() == '立即领取' && that.find('.q-range').text().indexOf("全品类") > -1) {
        var coupon_name = that.find('.q-range').text()
        var coupon_price = that.find('.q-price strong').text() + '元 (' + that.find('.q-limit').text() + ')'
        setTimeout(function () {
          $(that).find('.btn-def').trigger("click")
          setTimeout(function () {
            if ($(".tip-title").text() && $(".tip-title").text().indexOf("领取成功") > -1) {
              chrome.runtime.sendMessage({
                text: "coupon",
                title: "京价保自动领到一张全品类优惠券",
                content: JSON.stringify({
                  id: '',
                  batch: '',
                  price: coupon_price,
                  name: coupon_name
                })
              }, function (response) {
                console.log("Response: ", response);
              });
            }
          }, 1500)
        }, time)
        time += 5000;
      }
    })
  }
}

// 自动浏览店铺（7：店铺签到）
function autoVisitShop(setting) {
  if (setting != 'never') {
    weui.toast('京价保运行中', 1000);
    console.log('开始自动访问店铺领京豆')
    chrome.runtime.sendMessage({
      text: "run_status",
      jobId: "7"
    })
    var time = 0;
    $(".bean-shop-list li").each(function () {
      var that = $(this)
      if ($(that).find('.s-btn').text() == '去签到') {
        setTimeout(function () {
          chrome.runtime.sendMessage({
            text: "create_tab",
            batch: "bean",
            content: JSON.stringify({
              index: 0,
              url: $(that).find('.s-btn').attr('href'),
              active: "false",
              pinned: "true"
            })
          }, function (response) {
            console.log("Response: ", response);
          });
        }, time)
        time += 30000;
      }
    })
  }
}

// 店铺签到（7：店铺签到）
function doShopSign(setting) {
  if (setting != 'never') {
    console.log('店铺自动签到')
    chrome.runtime.sendMessage({ text: "myTab" }, function (result) {
      console.log('tab', result.tab)
      if (result.tab.pinned) {
        if ($(".j-unsigned.j-sign").length > 0 && $(".j-unsigned.j-sign").attr("status") == 'true') {
          simulateClick($('.j-unsigned.j-sign'))
        } else {
          setTimeout(function () {
            simulateClick($('.jSign .unsigned'))
          }, 3000)
        }
      } else {
        console.log('正常访问不执行店铺自动签到')
      }
    });
  }
}

// 移动页领取优惠券（2：领精选券）
function pickupCoupon(setting) {
  if (setting && setting != 'never') {
    let time = 0;
    console.log('开始领取精选券')
    chrome.runtime.sendMessage({
      text: "run_status",
      jobId: "2"
    })
    $(".coupon_sec_body a.coupon_default").each(function () {
      let that = $(this)
      let coupon_name = that.find('.coupon_default_name').text()
      let coupon_id = that.find("input[class=id]").val()
      let coupon_price = that.find('.coupon_default_price').text()
      if (that.find('.coupon_default_des').text()) {
        coupon_price = that.find('.coupon_default_des').text()
      }
      if ($(this).find('.coupon_default_status_icon').text() == '立即领取') {
        setTimeout(function () {
          simulateClick($(that).find('.coupon_default_status_icon'))
          setTimeout(function () {
            if ($(that).find('.coupon_default_status_icon').text() == '立即使用') {
              chrome.runtime.sendMessage({
                text: "coupon",
                title: "京价保自动领到一张新的优惠券",
                content: JSON.stringify({
                  id: coupon_id,
                  price: coupon_price,
                  name: coupon_name
                })
              }, function (response) {
                console.log("Response: ", response);
              });
            }
          }, 500)
        }, time)
        time += 5000;
      }
    })
  }
}

// 14: 钢镚签到
function getCoin(setting) {
  if (setting != 'never') {
    console.log('钢镚签到')
    chrome.runtime.sendMessage({
      text: "run_status",
      jobId: "14"
    })
    if ($("#myCanvas").length > 0) {
      let canvas = $("#myCanvas")[0]
      let rect = canvas.getBoundingClientRect()
      let startX = rect.left * (canvas.width / rect.width)

      sendTouchEvent(startX + 10, rect.y + 10, canvas, 'touchstart');
      sendTouchEvent(startX + 70, rect.y + 10, canvas, 'touchmove');
      sendTouchEvent(startX + 70, rect.y + 10, canvas, 'touchend');

      // 监控结果
      setTimeout(function () {
        if (($('.popup_reward_container .popup_gb_line').text() && $(".popup_reward_container .popup_gb_line").text().indexOf("获得") > -1)) {
          let re = /^[^-0-9.]+([0-9.]+)[^0-9.]+$/
          let rawValue = $(".popup_reward_container .popup_gb_line").text()
          let value = re.exec(rawValue)
          markCheckinStatus('coin', value[1] + '个钢镚', () => {
            chrome.runtime.sendMessage({
              text: "checkin_notice",
              title: "京价保自动为您签到抢钢镚",
              value: value[1],
              unit: 'coin',
              content: "恭喜您领到了" + value[1] + "个钢镚"
            }, function (response) {
              console.log("Response: ", response);
            })
          })
        }
      }, 1000)
    } else {
      markCheckinStatus('coin')
    }
  }
}

// 1: 价格保护
function priceProtect(setting) {
  if (setting != 'never') {
    weui.toast('京价保运行中', 1500);
    let mode = "m"
    // 加载第二页
    if (document.getElementById("mescroll0")) {
      document.getElementById("mescroll0").scrollTop = (document.getElementById("mescroll0").scrollHeight * 2);
      setTimeout(() => {
        document.getElementById("mescroll0").scrollTop = (document.getElementById("mescroll0").scrollHeight * 2);
      }, 300);
      setTimeout(() => {
        document.getElementById("mescroll0").scrollTop = (document.getElementById("mescroll0").scrollHeight * 2);
      }, 600);
      setTimeout(() => {
        document.getElementById("mescroll0").scrollTop =0
      }, 1000);
    }
    if (document.getElementById("dataList")) {
      mode = "pc"
      $(window).scrollTop(document.getElementById("dataList").scrollHeight * 2);
      setTimeout(() => {
        $(window).scrollTop(document.getElementById("dataList").scrollHeight * 2);
      }, 300);
      setTimeout(() => {
        $(window).scrollTop(document.getElementById("dataList").scrollHeight * 2);
      }, 600);
      setTimeout(() => {
        $(window).scrollTop(0)
      }, 1000);
    }

    if ($(".bd-product-list li").length > 0 || $(".co-th").length > 0) {
      console.log('成功获取价格保护商品列表', new Date())
      chrome.runtime.sendMessage({
        action: "run_status",
        jobId: "1",
        mode: mode
      })
      chrome.runtime.sendMessage({
        text: "getPriceProtectionSetting"
      }, function (response) {
        setTimeout(function () {
          getAllOrders(mode, response)
        }, 3000)
        console.log("getPriceProtectionSetting Response: ", response);
      });
    } else {
      console.log('好尴尬，最近没有买东西..', new Date())
    }
  }
}

// 从京东热卖自动跳转到商品页面
function autoGobuy(setting) {
  if (setting == "checked") {
    weui.toast('京价保自动跳转', 3000);
    simulateClick($(".shop_intro .gobuy a"))
  }
}

// 显示引荐来源
function showUtmSource() {
  const urlParams = new URLSearchParams(window.location.search);
  const utm_source = urlParams.get('utm_source');
  const utmSourceDom = `<div class="utm_source-notice">
    <div class="area_md">
      引荐来源：${utm_source}
      <span id="reportUtmSource" class="report">举报</span>
    </div>
  </div>`
  if (utm_source && utm_source.indexOf('zaoshu.so') < 0) {
    $("body").prepend(utmSourceDom);
  }
  $("#reportUtmSource").on("click", function () {
    weui.dialog({
      title: '举报劫持',
      content: `<iframe id="changelogIframe" frameborder="0" src="https://i.duotai.net/forms/znd7e/pliwjpzx?utm_source=${utm_source}" style="width: 100%;min-height: 385px;"></iframe>`,
      className: 'reportUtmSource',
      buttons: [{
        label: '完成',
        type: 'primary'
      }]
    })
  })
}

// 价格历史
function showPriceChart(disable) {
  if (disable == "checked") {
    console.log('价格走势图已禁用')
  } else {
    injectScript(chrome.extension.getURL('/static/priceChart.js'), 'body');
    window.addEventListener("message", function (event) {
      if (event.source != window)
        return;
      if (event.data.type && (event.data.type == "FROM_PAGE") && (event.data.text == "disablePriceChart")) {
        chrome.runtime.sendMessage({
          action: "setVariable",
          key: "disable_pricechart",
          value: "checked"
        },
        function (response) {
          weui.toast('停用成功', 1000);
          $(".jjbPriceChart").hide()
          console.log("disablePriceChart Response: ", response);
        });
      }
    });
  }
}

// 剁手保护模式
function handProtection(setting, priceInfo) {
  if (setting == "checked") {
    injectScript(chrome.extension.getURL('/static/dialog-polyfill.js'), 'body');
    console.log('剁手保护模式')
    let buyDom = $("#InitCartUrl").length > 0 ? $("#InitCartUrl") : $("#btn-reservation")
    let item = $(".ellipsis").text()
    let price = priceInfo ? (priceInfo.normal_price || priceInfo.plus_price) : ($('.p-price .price').text() ? $('.p-price .price').text().replace(/[^0-9\.-]+/g, "") : null) || ($('#jd-price').text() ? $('#jd-price').text().replace(/[^0-9\.-]+/g, "") : null)
    // 拼接提示
    let dialogMsgDOM = `<dialog id="dialogMsg" class="message">` +
      `<p class="green-text">恭喜你省下了 ` + price + ` ！</p>` +
      `</dialog>`
    // 写入提示消息
    $("body").append(dialogMsgDOM);

    buyDom.removeAttr("clstag")
    buyDom.on("click", function () {
      let count = $('#buy-num').val()
      // 移除此前的提示
      if ($("#dialog").size() > 0) {
        $("#dialog").remove()
      }
      // 拼接提示
      let dialogDOM = `<dialog id="dialog">` +
        `<span class="close">x</span>` +
        `<form method="dialog">` +
        `<h3>你真的需要买` + (Number(count) > 1 ? count + '个' : '') + item + `吗?</h3>` +
        `<div class="consideration">` +
        `<p>它是必须的吗？使用的频率足够高吗？</p>` +
        `<p>它真的可以解决你的需求吗？现有方案完全无法接受吗？</p>` +
        `<p>如果收到不合适，它在试用之后退款方便吗？</p>` +
        `<p>现在购买它的价格 ` + price + ` 合适吗？</p>` +
        (Number(count) > 1 ? `<p>有必要现在购买 ` + count + `个吗？</p>` : '') +
        `</div>` +
        `<div class="actions">` +
        `<a href="` + buyDom.attr("href") + `" class="volume-purchase forcedbuy" target="_blank">坚持购买</a>` +
        `<button type="submit" value="no" class="giveUp btn-special2 btn-lg" autofocus>一键省钱</button>` +
        `</div>` +
        `<p class="admonish">若无必要，勿增实体</p>` +
        `</form>` +
        `</dialog>`
      // 写入提示
      $("body").append(dialogDOM);
      var dialog = document.getElementById('dialog');
      var dialogMsg = document.getElementById('dialogMsg');

      dialog.showModal();
      document.querySelector('#dialog .close').onclick = function () {
        dialog.close();
      };

      document.querySelector('#dialog .giveUp').onclick = function () {
        dialog.close();
        setTimeout(() => {
          dialogMsg.showModal();
        }, 50);
        setTimeout(() => {
          dialogMsg.close();
          if (confirm("京价保剁手保护模式准备帮你关闭这个标签页，确认要关闭吗?")) {
            window.close();
          }
        }, 1000);
      };

      return false;
    })
  }
}

// 模拟点击
function simulateClick(dom, mouseEvent) {
  let domNode = dom.get(0)
  if (mouseEvent && domNode) {
    return mockClick(domNode)
  }
  try {
    dom.trigger("tap")
    dom.trigger("click")
  } catch (error) {
    try {
      mockClick(domNode)
    } catch (err) {
      console.log('fullback to mockClick', err)
    }
  }
}

function markCheckinStatus(type, value, cb) {
  chrome.runtime.sendMessage({
    action: "markCheckinStatus",
    batch: type,
    value: value,
    status: "signed"
  }, function (response) {
    console.log('markCheckinStatus response', response)
    if (cb && response) { cb() }
  });
}

var auto_login_html = "<p class='auto_login'><span class='jjb-login'>让京价保记住密码并自动登录</span></p>";
var remberme_html = `<label for="remberme" class="remberme J_ping" report-eventid="MLoginRegister_AutoLogin">
  <input type="checkbox" id="remberme" checked>
  <span class="icon icon-rember"></span>
  <span class="txt-remberme">一个月内免登录</span>
  </label>`

// 保存账号
function saveAccount(account) {
  chrome.runtime.sendMessage({
    text: "saveAccount",
    content: JSON.stringify(account)
  }, function (response) {
    console.log('saveAccount response', response)
  });
}

// 获取账号信息
function getAccount(type) {
  console.log("getAccount", type)
  chrome.runtime.sendMessage({
    text: "getAccount",
    type: type
  },
  function (account) {
    if (account && account.username && account.password) {
      setTimeout(() => {
        autoLogin(account, type)
      }, 50);
    } else {
      chrome.runtime.sendMessage({
        action: "saveLoginState",
        state: "failed",
        message: "由于账号未保存无法自动登录",
        type: type
      }, function (response) {
        console.log("Response: ", response);
      });
    }
  });
}
// 获取设置
function getSetting(name, cb) {
  chrome.runtime.sendMessage({
    text: "getSetting",
    content: name
  }, function (response) {
    cb(response)
    console.log("getSetting Response: ", name, response);
  });
}

// 登录失败
function dealLoginFailed(type, errormsg) {
  let loginFailedDetail = {
    text: "loginFailed",
    type: type,
    notice: true,
    content: errormsg,
    state: "failed"
  }
  // 如果是单纯的登录页面，则不发送浏览器提醒
  if (window.innerWidth == 420 || window.location.href == "https://passport.jd.com/uc/login") {
    loginFailedDetail.notice = false
    console.log("主动登录页面不发送浏览器消息提醒")
  }
  chrome.runtime.sendMessage(loginFailedDetail, function (response) {
    console.log("loginFailed Response: ", response);
  });
}

function getBase64Image(img) {
  var canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  var ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  var dataURL = canvas.toDataURL("image/png");

  return dataURL.replace(/^data:image\/(png|jpg);base64,/, "");
}

// 自动登录
function autoLogin(account, type) {
  if (account.autoLoginQuota && account.autoLoginQuota < 1) {
    return console.log('当前时段无可用自动登录配额，暂不运行自动登录', type)
  }
  weui.toast('京价保正在自动登录', 1000);
  function login(type) {
    chrome.runtime.sendMessage({
      action: "autoLogin",
      type: type
    }, function (response) {
      console.log("autoLogin Response: ", response);
    });
    if (type == 'pc') {
      simulateClick($(".login-btn a"))
    } else {
      simulateClick($("#loginBtn"))
    }
  }

  if (type == 'pc') {
    // 自动补全填入
    $("#loginname").val(account.username)
    $("#nloginpwd").val(account.password)
    // 监控验证结果
    let authcodeDom = document.getElementById("s-authcode")
    if (authcodeDom) {
      observeDOM(authcodeDom, function () {
        let resultText = $("#s-authcode .authcode-btn").text()
        if (resultText && resultText == "验证成功") {
          login('pc')
        }
      });
    }
    // 如果此前已经登录失败
    if (account.loginState && account.loginState.state == 'failed') {
      $(".tips-inner .cont-wrapper p").text('由于在' + account.loginState.displayTime + '自动登录失败（原因：' + account.loginState.message + '），京价保暂停自动登录').css('color', '#f73535').css('font-size', '14px')
      $(".login-wrap .tips-wrapper").hide()
      $("#content .tips-wrapper").css('background', '#fff97a')
      chrome.runtime.sendMessage({
        text: "highlightTab",
        content: JSON.stringify({
          url: window.location.href,
          pinned: "true"
        })
      }, function (response) {
        console.log("Response: ", response);
      });
    } else {
      // 如果显示需要验证
      if ($("#s-authcode").height() > 0) {
        dealLoginFailed("pc", "需要完成登录验证")
      } else {
        setTimeout(function () {
          login('pc')
        }, 500)
        // 是否需要滑动验证
        setTimeout(function () {
          let slidemsg = $(".JDJRV-suspend-slide .JDJRV-lable-refresh").text()
          if (slidemsg.length > 0) {
            dealLoginFailed("pc", "需要完成登录验证")
            chrome.runtime.sendMessage({
              text: "highlightTab",
              content: JSON.stringify({
                title: "需要完成滑动拼图以登录",
                url: window.location.href,
                pinned: "true"
              })
            }, function (response) {
              console.log("Response: ", response);
            });
          }
        }, 1500)
        // 监控登录失败
        setTimeout(function () {
          let errormsg = $('.login-box .msg-error').text()
          if (errormsg.length > 0) {
            dealLoginFailed("pc",errormsg)
          }
        }, 2000)
      }
    }
  // 手机登录
  } else {
    $("#username").val(account.username)
    $("#password").val(account.password)
    $("#loginBtn").addClass("btn-active")
    // 自动登录
    function mLogin() {
      setTimeout(function () {
        if ($("#username").val() && $("#password").val()) {
          login('m')
          // 是否需要滑动验证
          setTimeout(function () {
            let slidemsg = $("#captcha_body .sp_msg").text()
            if (slidemsg) {
              dealLoginFailed("m", "需要完成登录验证")
            }
          }, 1000)
          // 监控失败提示
          setTimeout(function () {
            observeDOM($(".notice")[0], function () {
              let errormsg = $(".notice").text()
              if (errormsg.length > 0) {
                dealLoginFailed("m", errormsg)
              }
            })
          }, 500)
        }
      }, 500)
    }
    // 如果需要验证码
    if ($("#input-code").height() > 0) {
      tryFillCaptcha()
    } else {
      mLogin()
    }
  }
}


function dealWithCaptchaError(isRetry, error) {
  console.log('dealWithCaptchaError', error)
  if (isRetry) {
    dealLoginFailed("m", "需要完成登录验证")
  } else {
    setTimeout(() => {
      tryFillCaptcha(true)
    }, 500);
  }
}

// 识别验证码
function tryFillCaptcha(isRetry) {
  let captcha = $("#username_login .code-box img")[0]
  let base64Image = getBase64Image(captcha)
  $("#username_login").append(`<div class="weui-loadmore">
        <i class="weui-loading"></i>
        <span class="weui-loadmore__tips">${isRetry ? '正在重新识别验证码' : '正在识别验证码'}</span>
    </div>
  `)
  $.ajax({
    method: "POST",
    type: "POST",
    url: "https://jjb.zaoshu.so/captcha",
    data: {
      base64Image: base64Image,
    },
    timeout: 8000,
    dataType: "json",
    success: function(data){
      if (data.result && data.result.length > 3) {
        if ($("#code").is(":focus") || $("#code").val().length > 0 ) {
          $("#username_login").append(`<p class="tips">验证码参考：${data.result}</p>`)
        } else {
          $("#code").val(data.result)
          mLogin()
        }
      } else {
        dealWithCaptchaError(isRetry, data.result)
      }
    },
    error: function(xhr, type){
      dealWithCaptchaError(isRetry, xhr)
    },
    complete: function() {
      $("#username_login .weui-loadmore").hide()
    }
  })
}

// 转存老的账号
function resaveAccount() {
  var jjb_username = localStorage.getItem('jjb_username')
  var jjb_password = localStorage.getItem('jjb_password')
  if (jjb_username && jjb_password) {
    localStorage.removeItem('jjb_username')
    localStorage.removeItem('jjb_password')
    saveAccount({
      username: jjb_username,
      password: jjb_password
    })
  }
}

// 登录页
function dealLoginPage() {
  // 手机版登录页
  if ( $(".loginPage").length > 0 ) {
    getAccount('m')
    $(auto_login_html).insertAfter( ".loginPage .notice")
    // 隐藏“一键登录”
    $("#loginOneStep").hide()
    // 点击让京价保自动登陆
    $('.loginPage').on('click', '.jjb-login', function (e) {
      window.event ? window.event.returnValue = false : e.preventDefault();
      var username = $("#username").val()
      var password = $("#password").val()
      // 保存账号和密码
      if (username && password) {
        saveAccount({
          username: username,
          password: password
        })
      }
      simulateClick($("#loginBtn"))
    })
  };
  // PC版登录页
  if ($(".login-tab-r").length > 0) {
    // 切换到账号登录
    simulateClick($(".login-tab-r a"))
    // 获取账号
    getAccount('pc')
    $(auto_login_html).insertAfter("#formlogin")
    $('.login-box').on('click', '.jjb-login', function (e) {
      window.event ? window.event.returnValue = false : e.preventDefault();
      var username = $("#loginname").val()
      var password = $("#nloginpwd").val()
      // 保存账号和密码
      if (username && password) {
        saveAccount({
          username: username,
          password: password
        })
      }
      simulateClick($(".login-btn a"))
    })
  }
  return this;
}
// 签到领京豆（vip）
function vipCheckin(setting) {
  if (setting != 'never') {
    console.log('签到领京豆（vip）')
    weui.toast('京价保运行中', 1000);
    chrome.runtime.sendMessage({
      text: "run_status",
      jobId: "5"
    })
    const signRes = $(".signin-desc").text() || $(".dayGet").text()
    if (signRes && (signRes.indexOf("获得") > -1 || signRes.indexOf("已领取") > -1)) {
      let value = $(".beanNum").text() || signRes.substring(signRes.indexOf("获得")).replace(/[^0-9\.-]+/g, "")
      markCheckinStatus('vip', value + '京豆', () => {
        chrome.runtime.sendMessage({
          text: "checkin_notice",
          batch: "bean",
          value: value,
          unit: 'bean',
          title: "京价保自动为您签到领京豆",
          content: "恭喜您获得了" + value + '个京豆奖励'
        }, function (response) {
          console.log("Response: ", response);
        })
      })
    }
  }
  return this;
}

// 16: 白条签到（baitiao）
function baitiaoLottery(setting) {
  if (setting != 'never') {
    console.log('白条签到（baitiao）')
    weui.toast('京价保运行中', 1000);

    chrome.runtime.sendMessage({
      text: "run_status",
      jobId: "16"
    })
    setTimeout(() => {
      simulateClick($("#lottery .mark_btn_start"), true)
    }, 1500);
    observeDOM(document.body, function () {
      if ($(".layer_wrap_header").text() == '恭喜你获得') {
        let value = $(".layer_wrap_gold_text").text().replace(/[^0-9\.-]+/g, "")
        markCheckinStatus('baitiao', $(".layer_wrap_gold_text").text(), () => {
          chrome.runtime.sendMessage({
            text: "checkin_notice",
            batch: "bean",
            value: value,
            unit: 'bean',
            title: "京价保自动为您白条签到",
            content: "恭喜您获得了" + $(".layer_wrap_gold_text").text()
          }, function (response) {
            console.log("Response: ", response);
          })
        })
      }
      if ($(".jrm-tips").text() == '您今天已签到,请明天再来') {
        markCheckinStatus('baitiao')
      }
    })
  }
  return this;
}

// 2: 萌犬庄园（petdog）
function petDog(setting) {
	if (setting != 'never') {
		weui.toast('京价保运行中', 1000);

		chrome.runtime.sendMessage({
			text: "run_status",
			jobId: "2"
		})

		setTimeout(() => {
			var feedBtn = $('.wqpd_features_dogfoods');
			var timeoutLbl = $(".wqpd_features_dogpot_timeout");
			if (timeoutLbl.length <= 0 && feedBtn.length > 0) {
				console.log('喂狗');
				simulateClick($('.wqpd_features_dogfoods'), true);
			}
		}, 500);

		setTimeout(() => {
			if ('可领取' == $('.wqpd_features_foods_item_tips').text()) {
				console.log('领每日狗粮');
				simulateClick($('.wqpd_features_foods_item_num'), true);
			}
		}, 1000);

		var taskBtn = $('.wqpd_features_tasks');
		setTimeout(() => {
			if (taskBtn.length > 0) {
				console.log('弹出任务列表');
				simulateClick(taskBtn, true);
			}
		}, 1500);

		observeDOM(document.body, () => {
			var levelUpBtn = $(".wqpd_alert_btn");
			var levelTxt = $(".wqpd_alert_sp_title_level");
			if (levelUpBtn.length > 0 && levelTxt.length > 0 && levelTxt.text()) {
				console.log('恭喜升到%s！', levelTxt.text());
				simulateClick(levelUpBtn, true);
			}

			var all_done = true;
			var btns = $(".wqpd_rasks_lists_item_btn");
			var closeBtn = $(".pet-popup.pep-popup_show .wqpd_updates_close");
			btns.filter((i) => {
				if ('明日再来' === btns.get(i).textContent) {
					return this;
				}

				all_done = false;
				switch (i) {
					case 0: // 分享
						if ('去完成' == $(".wqpd_rasks_lists_item_btn.type_blue[ptag$='1']").text()) {
							setTimeout(() => {
								$.ajax({
									method: "GET",
									type: "GET",
									url: "https://wq.jd.com/petmanor/petmodule/DoTask?type=1&channel=1&_=" + Date.now() + "&g_login_type=0&callback=jsonpCBKM&g_tk=1118503140&g_ty=ls",
									timeout: 5000,
									success: function(data) {
										console.log('已完成一次分享任务！');
									},
									error: function(xhr, type) {
										console.log('完成分享任务发生错误：', type);
									}
								});
							}, 2000);
						} else if ('领狗粮' == $(".wqpd_rasks_lists_item_btn.type_orange[ptag$='4']").text()) {
							setTimeout(() => {
								console.log('已领取分享获得的狗粮！');
								simulateClick($(".wqpd_rasks_lists_item_btn.type_orange[ptag$='4']"), true)
							}, 2000);
						}
						break;

					case 1: // 浏览商品页
						if ('去完成' == $(".wqpd_rasks_lists_item_btn.type_blue[ptag$='2']").text()) {
							setTimeout(() => {
								$.ajax({
									method: "GET",
									type: "GET",
									url: "https://wq.jd.com/petmanor/petmodule/DoTask?type=2&channel=1&_=" + Date.now() + "&g_login_type=0&callback=jsonpCBKM&g_tk=1118503140&g_ty=ls",
									timeout: 5000,
									success: function(data) {
										console.log('已完成一次浏览商品页任务！');
									},
									error: function(xhr, type) {
										console.log('完成浏览商品页任务发生错误：', type);
									}
								});
							}, 2500);
						} else if ('领狗粮' == $(".wqpd_rasks_lists_item_btn.type_orange[ptag$='5']").text()) {
							setTimeout(() => {
								console.log('已领取浏览商品页获得的狗粮！');
								simulateClick($(".wqpd_rasks_lists_item_btn.type_orange[ptag$='5']"), true)
							}, 2500);
						}
						break;

					case 2: // 购买商品
						if ('去完成' == $(".wqpd_rasks_lists_item_btn.type_blue[ptag$='3']").text()) {
							setTimeout(() => {
								$.ajax({
									method: "GET",
									type: "GET",
									url: "https://wq.jd.com/petmanor/petmodule/DoTask?type=3&channel=1&_=" + Date.now() + "&g_login_type=0&callback=jsonpCBKM&g_tk=1118503140&g_ty=ls",
									timeout: 5000,
									success: function(data) {
										console.log('已完成一次购买商品任务！');
									},
									error: function(xhr, type) {
										console.log('完成购买商品任务发生错误：', type);
									}
								});
							}, 3000);
						} else if ('领狗粮' == $(".wqpd_rasks_lists_item_btn.type_orange[ptag$='6']").text()) {
							setTimeout(() => {
								console.log('已领取购买商品获得的狗粮！');
								simulateClick($(".wqpd_rasks_lists_item_btn.type_orange[ptag$='6']"), true)
							}, 3000);
						}
						break;

					default:
						return this;
				}

				setTimeout(() => {
					if (closeBtn.length > 0) {
						console.log('刷新任务列表');
						simulateClick(closeBtn, true);
						setTimeout(() => {
							if (taskBtn.length > 0) {
								simulateClick(taskBtn, true);
							}
						}, 500);
					}
				}, 3500);
			});

			if (all_done) {
				setTimeout(() => {
					if (closeBtn.length > 0) {
						console.log('所有任务已完成，关闭任务列表');
						simulateClick(closeBtn, true);
					}
				}, 3500);
			}
		});
	}
	return this;
}

// 8: 种豆得豆（plantbean）
function plantBean(setting) {
	if (setting != 'never') {
		console.log('种豆得豆（plantbean）')
		weui.toast('京价保运行中', 1000);

		chrome.runtime.sendMessage({
			text: "run_status",
			jobId: "8"
		})
		setTimeout(() => {
			// var nutrient = $("[style$='transform: scale(1);']");
			var nutrient = $("[style$='align-items: center; justify-content: flex-end;'] img");
			if (null === nutrient) {
				console.log('没有找到养料领取图标！！！');
			} else {
				setTimeout(() => {
					var foster = $("[style^='transform: scale(1);'] img");
					if (null === foster) {
						console.log('没有找到培养图标！！！');
					} else {
						simulateClick(foster, true)
						console.log('已培养豆苗', foster);
					}
				}, 2000);

				simulateClick(nutrient, true)
				console.log('已领取养料', nutrient);
			}
		}, 500);
	}
	return this;
}

// 10：京东金融新人礼
function dailyJDJRXRL(setting) {
	if (setting != 'never') {
		weui.toast('京价保运行中', 1000);
		chrome.runtime.sendMessage({
			text: "run_status",
			jobId: "10"
		});

		setTimeout(() => {
			$("[type='number']").val(13000000000);
			setTimeout(() => {
				simulateClick($(".draw-getPrize-btn"), true);
				markCheckinStatus('jdjrxrl');
			}, 1500);
		}, 1500);
	}
	return this;
}

// 12：超市签到有礼
function dailyCSQDYL(setting) {
	if (setting != 'never') {
		weui.toast('京价保运行中', 1000);
		chrome.runtime.sendMessage({
			text: "run_status",
			jobId: "12"
		});

		setTimeout(() => {
			simulateClick($(".signIn_btnTxt"), true);
			markCheckinStatus('csqdyl');
		}, 1500);
	}
	return this;
}

// 13：小羊毛抽好礼
function dailyXYMCHL(setting) {
	if (setting != 'never') {
		weui.toast('京价保运行中', 1000);
		chrome.runtime.sendMessage({
			text: "run_status",
			jobId: "13"
		});

		setTimeout(() => {
			simulateClick($(".push-text"), true);
			markCheckinStatus('xymchl');
		}, 1500);
	}
	return this;
}

// 18：京东礼品卡
function dailyJDLPK(setting) {
	if (setting != 'never') {
		weui.toast('京价保运行中', 1000);
		chrome.runtime.sendMessage({
			text: "run_status",
			jobId: "18"
		});

		setTimeout(() => {
			simulateClick($(".pointer_wrap img"), true);
			markCheckinStatus('jdlpk');
		}, 1500);
	}
	return this;
}

// 19：白条权益中心
function dailyBTQYZX(setting) {
	if (setting != 'never') {
		weui.toast('京价保运行中', 1000);
		chrome.runtime.sendMessage({
			text: "run_status",
			jobId: "19"
		});

		setTimeout(() => {
			simulateClick($("[clstag='jr|keycount|BTQYZX|indexSign']"), true);
			markCheckinStatus('btqyzx');
		}, 1500);
	}
	return this;
}

// 20：拍拍二手签到有礼
function dailyPPESQDYL(setting) {
	if (setting != 'never') {
		weui.toast('京价保运行中', 1000);
		chrome.runtime.sendMessage({
			text: "run_status",
			jobId: "20"
		});

		setTimeout(() => {
			simulateClick($(".signIn_btnTxt"), true);
			markCheckinStatus('ppesqdyl');
		}, 1500);
	}
	return this;
}

// 21：天天领福利1
function dailyTTLFL1(setting) {
	if (setting != 'never') {
		weui.toast('京价保运行中', 1000);
		chrome.runtime.sendMessage({
			text: "run_status",
			jobId: "21"
		});

		setTimeout(() => {
			simulateClick($("[clstag='pageclick|keycount|hym_01|choujiang']"), false);
			// markCheckinStatus('ttlfl1');
		}, 1500);
	}
	return this;
}

// 22：天天领福利2
function dailyTTLFL2(setting) {
	if (setting != 'never') {
		weui.toast('京价保运行中', 1000);
		chrome.runtime.sendMessage({
			text: "run_status",
			jobId: "22"
		});

		setTimeout(() => {
			simulateClick($("[clstag='pageclick|keycount|hym_01|choujiang']"), true);
			// TODO 领取按钮 $(".btn[clstag='pageclick|keycount|Qing_undefined_undefined|undefined_undefined|null']")
			// TODO 抽奖按钮分享前不可用 $(".btn.gray[clstag='pageclick|keycount|hym_01|choujiang']")
			// TODO var bb = $(".btn"); bb.filter((i)=>{if ('立即领取' == bb.get(i).textContent) console.log(bb.get(i));});
			// markCheckinStatus('ttlfl2');
		}, 1500);
	}
	return this;
}

// 23：现金红包免费抢
function dailyXJHBMFQ(setting) {
	if (setting != 'never') {
		weui.toast('京价保运行中', 1000);
		chrome.runtime.sendMessage({
			text: "run_status",
			jobId: "23"
		});

		setTimeout(() => {
			simulateClick($("[clstag='pageclick|keycount|zfqmb_2018|khb']"), true);
			setTimeout(() => {
				simulateClick($("[clstag='pageclick|keycount|zfqmb_2018|outljlq']"), true);
				markCheckinStatus('xjhbmfq');
			}, 1000);
		}, 1000);
	}
	return this;
}

// 24：京东财富送惊喜
function dailyJDCFSJX(setting) {
	if (setting != 'never') {
		weui.toast('京价保运行中', 1000);
		chrome.runtime.sendMessage({
			text: "run_status",
			jobId: "24"
		});

		setTimeout(() => {
			simulateClick($("[clstag='pageclick|keycount|llhb_2018mz|khb']"), true);
			setTimeout(() => {
				simulateClick($("[clstag='pageclick|keycount|llhb_2018mz1|outljlq']"), true);
				markCheckinStatus('jdcfsjx');
			}, 1000);
		}, 1000);
	}
	return this;
}

// 25：每天领钢镚
function dailyMTLGB(setting) {
	if (setting != 'never') {
		weui.toast('京价保运行中', 1000);
		chrome.runtime.sendMessage({
			text: "run_status",
			jobId: "25"
		});

		setTimeout(() => {
			simulateClick($(".absolute.tModel_2 .t_1B img"), true);
			markCheckinStatus('mtlgb');
		}, 1500);
	}
	return this;
}

// 26：京东用户每日福利
function dailyJDYHMRFL(setting) {
	if (setting != 'never') {
		weui.toast('京价保运行中', 1000);
		chrome.runtime.sendMessage({
			text: "run_status",
			jobId: "26"
		});

		setTimeout(() => {
			var btnSign = $(".signDay_day_item.day_able .signDay_day_top");
			if (btnSign.length > 0) {
				console.log('签到');
				simulateClick(btnSign, true);
			}
		}, 1500);
		setTimeout(() => {
			var lotteryBtn = $(".lottery_btn");
			if (lotteryBtn.length > 0) {
				console.log('抽奖');
				simulateClick(lotteryBtn, true);
			}
		}, 2000);

		observeDOM(document.body, () => {
			var mainPage = 'https://wqs.jd.com/promote/201712/mwelfare/m.html';
			if (window.location.href.indexOf(mainPage) < 0) {
				console.log('跳转回到活动页面');
				setTimeout(() => {
					window.location.href = mainPage;
				}, 2000);
				return this;
			}

			var btnOK1 = $(".J_dia_btn");
			if (btnOK1.length > 0 && '确定' == btnOK1.text()) {
				simulateClick(btnOK1, true);
			}

			var btnOK2 = $(".dia[style='display: block;'] .dia_btm_one");
			if (btnOK2.length > 0 && '我知道了' == btnOK2.text()) {
				simulateClick(btnOK2, true);
			}

			var browsing = false;
			var interval = 2500;
			$(".welfareTask_btn").each((i,v) => {
				var getBtn = $(v);
				if (getBtn.length > 0 && '立即前往' == getBtn.text()) {
					if (browsing) return;

					setTimeout(() => {
						browsing = true;
						console.log('访问奖励页面');
						simulateClick(getBtn, true);
						setTimeout(() => {
							console.log('退回领奖页面');
							window.history.back(-1);
						}, 1000);
					}, 1000);
				} else if (getBtn.length > 0 && '点击领取' == getBtn.text()) {
					setTimeout(() => {
						console.log('领取京豆奖励');
						simulateClick(getBtn, true);
					}, interval);

					interval += 500;
				}
			});
		});
	}
	return this;
}

// 27：流量加油站
function dailyLLJYZ(setting) {
	if (setting != 'never') {
		weui.toast('京价保运行中', 1000);
		chrome.runtime.sendMessage({
			text: "run_status",
			jobId: "27"
		});

		setTimeout(() => {
			simulateClick($("[style$='background-size: cover; background-repeat: no-repeat; background-position: 50% center;']"), true);
			markCheckinStatus('lljyz');
		}, 1500);
	}
	return this;
}

// 28：新年钱多多
function dailyXNQDD(setting) {
	if (setting != 'never') {
		weui.toast('京价保运行中', 1000);
		chrome.runtime.sendMessage({
			text: "run_status",
			jobId: "28"
		});

		setTimeout(() => {
			var getBtn = $("[clstag='pageclick|keycount|qianduoduo|index_open']");
			if (getBtn.length > 0) {
				simulateClick(getBtn, true);
			}
		}, 500);

		setTimeout(() => {
			var getBtn = $("[clstag='pageclick|keycount|qianduoduo|detail_2summary']");
			if (getBtn.length > 0) {
				simulateClick(getBtn, true);
			}
		}, 1000);

		setTimeout(() => {
			var getBtn = $("[clstag='pageclick|keycount|qianduoduo|summary_2withdraw'].summary");
			if (getBtn.length > 0) {
				simulateClick(getBtn, true);
			}
		}, 1500);

		setTimeout(() => {
			var getBtn = $("[clstag='pageclick|keycount|qianduoduo|withdraw'].tappable.pulse.btn-withdraw");
			if (getBtn.length > 0) {
				simulateClick(getBtn, true);
			}
			markCheckinStatus('xnqdd');
		}, 2000);
	}
	return this;
}

// 29：翻牌中大奖
function dailyFPZDJ(setting) {
	if (setting != 'never') {
		weui.toast('京价保运行中', 1000);
		chrome.runtime.sendMessage({
			text: "run_status",
			jobId: "29"
		});

		setTimeout(() => {
			simulateClick($(".drawCont-item"), true); // 翻哪张牌都一样~
			markCheckinStatus('fpzdj');
		}, 1500);
	}
	return this;
}

// 30：京东支付单单返
function dailyJDZFDDF(setting) {
	if (setting != 'never') {
		weui.toast('京价保运行中', 1000);
		chrome.runtime.sendMessage({
			text: "run_status",
			jobId: "30"
		});

		setTimeout(() => {
			var beans = parseInt($(".beens-part .number").text());
			if (beans <= 0) {
				return this;
			}

			simulateClick($(".beens-part [clstag='pageclick|keycount|ZHQYZX|3']"), true);
			markCheckinStatus('fpzdj');
		}, 1500);
	}
	return this;
}

// 31：双签领奖励
function dailySQLJL(setting) {
	if (setting != 'never') {
		weui.toast('京价保运行中', 1000);
		chrome.runtime.sendMessage({
			text: "run_status",
			jobId: "31"
		});

		setTimeout(() => {
			var signed = true;
			var btns = $(".item-btn.active");
			btns.filter((i) => {
				signed &= (btns.get(i).text.indexOf('今日已签') >= 0);
			});
			if (!signed) {
				return this;
			}

			var btnGetDbl = $(".item-btn[clstag^='jr|']");
			if (btnGetDbl.length > 0 && btnGetDbl.text().indexOf('完成双签领取') >= 0) {
				console.log('弹出双签奖励页');
				simulateClick(btnGetDbl, true);
			}
		}, 1000);

		// observeDOM(document.body, () => {
			// var btnGet = $(".success-btn");
			// if (btnGet.length > 0 && '立即领取' == btnGet.text()) {
				// setTimeout(() => {
					// console.log('领取双签奖励');
					// simulateClick(btnGet, true);
					// markCheckinStatus('sqljl');
				// }, 1000);
			// }
		// });
	}
	return this;
}

// 32：白条额度
function dailyBTED(setting) {
	if (setting != 'never') {
		weui.toast('京价保运行中', 1000);
		chrome.runtime.sendMessage({
			text: "run_status",
			jobId: "32"
		});

		setTimeout(() => {
			var raiseImg = $("[clstag='jr|keycount|bn_bt_raise|rise_limit'] img");
			if (raiseImg.length <= 0) {
				console.log('暂无可提升的额度');
				markCheckinStatus('bted');
			}

			var raiseBtn = $("[clstag='jr|keycount|bn_bt_raise|rise_limit']");
			if (raiseBtn.length > 0) {
				console.log('弹出提升额度窗口');
				simulateClick(raiseBtn, true);
			}
		}, 1500);

		observeDOM(document.body, () => {
			setTimeout(() => {
				var doRaiseBtn = $(".react-view.btn-box-shadow");
				if (doRaiseBtn.length > 0 && '提升额度' == doRaiseBtn.text()) {
					console.log('提升额度');
					simulateClick(doRaiseBtn, true);
				}
			}, 1500);

			markCheckinStatus('bted');
		});
	}
	return this;
}

// 33：免费领健康保障金
function dailyMFLJKBZJ(setting) {
	if (setting != 'never') {
		weui.toast('京价保运行中', 1000);
		chrome.runtime.sendMessage({
			text: "run_status",
			jobId: "33"
		});

		setTimeout(() => {
			var getBtn = $(".headBtnFont");
			if (getBtn.length > 0 && '立即领取' == getBtn.text()) {
				simulateClick(getBtn, true);
			}

			markCheckinStatus('mfljkbzj');
		}, 1500);
	}
	return this;
}

// 34：京豆大转盘
function dailyJDDZP(setting) {
	if (setting != 'never') {
		weui.toast('京价保运行中', 1000);
		chrome.runtime.sendMessage({
			text: "run_status",
			jobId: "34"
		});

		var times = $("[style^='display: inline; margin: 0px; padding: 0px;'][style*='color: rgb(255, 224, 72);']");
		if (!times || !times.textContent || parseInt(times.textContent) <= 0) {
			markCheckinStatus('jddzp');
			return this;
		}

		setTimeout(() => {
			var goBtn = $("[style^='justify-content: center; align-items: center;'] [style^='background-color: transparent;'] img");
			if (goBtn) {
				simulateClick(goBtn, true);
			}
		}, 1500);

		observeDOM(document.body, () => {
			setTimeout(() => {
				if (!times || !times.textContent || parseInt(times.textContent) <= 0) {
					markCheckinStatus('jddzp');
					return this;
				}

				var goBtn = $("[style^='justify-content: center; align-items: center;'] [style^='background-color: transparent;'] img");
				if (goBtn) {
					simulateClick(goBtn, true);
				}
			}, 1000);
		});
	}
	return this;
}

// 17: 小羊毛
function dailyJDBeans(setting) {
  if (setting != 'never') {
    weui.toast('京价保运行中', 1000);
    chrome.runtime.sendMessage({
      text: "run_status",
      jobId: "17"
    })

    if ($(".daily-bonus .opened .red").text() == "红包已领取了哦" && $(".daily-bonus .opened .red").height() > 0) {
      let value = $(".daily-bonus .opened .info .red_l").text()
      markCheckinStatus('xym', value)
    } else if ($(".daily-bonus .click-icon")) {
      simulateClick($(".daily-bonus .click-icon"))
      setTimeout(function () {
        const signRes = $(".xym-dialog .hit .title").text()
        const signResContent = $(".xym-dialog .message .content").text()
        if (signRes && signRes.indexOf("获得") > -1) {
          let value = signRes.replace(/[^0-9\.-]+/g, "")
          markCheckinStatus('xym', value + '京豆', () => {
            chrome.runtime.sendMessage({
              text: "checkin_notice",
              batch: "bean",
              value: value,
              unit: 'bean',
              title: "京价保自动为您领取京东京豆红包",
              content: "恭喜您获得了" + value + '个京豆奖励'
            }, function (response) {
              console.log("Response: ", response);
            })
          })
        } else if (signResContent && signResContent.indexOf("未登录") > -1) {
          simulateClick($(".xym-dialog .button"))
        }
      }, 2000)
    }
  }
}

// 11: 每日京豆签到（bean）
function beanCheckin(setting) {
  if (setting != 'never') {
    console.log('京豆签到（bean）')
    weui.toast('京价保运行中', 1000);
    chrome.runtime.sendMessage({
      text: "run_status",
      jobId: "11"
    })
    var beanbtn = null
    $("#m_common_content .react-view .react-view .react-view .react-view .react-view .react-view .react-view .react-view .react-view .react-view .react-view .react-view .react-view .react-view span").each(function () {
      let targetEle = $(this)
      if (targetEle.text() == '签到领京豆') {
        simulateClick(targetEle, true)
        setTimeout(() => {
          let beanCheckinRes = $(".gradBackground").text()
          if (beanCheckinRes && beanCheckinRes.indexOf("恭喜您获得") > -1){
            markCheckinStatus('bean', null, () => {
              chrome.runtime.sendMessage({
                text: "checkin_notice",
                batch: "bean",
                unit: 'bean',
                title: "京价保自动为您签到领京豆",
                content: "恭喜您获得了一两个京豆奖励"
              }, function (response) {
                console.log("Response: ", response);
              })
            })
          }
        }, 500);
      }
    })

    const beanCheckinRes = $(".gradBackground").text()
    if (beanCheckinRes && beanCheckinRes.indexOf("恭喜您获得") > -1){
      markCheckinStatus('bean')
    }

    $("#m_common_content .react-view .react-view .react-view .react-view .react-view .react-view .react-view .react-view .react-view .react-view .react-view .react-view .react-view .react-view span").each(function () {
      if ($(this).text() == '已连续签到') {
        markCheckinStatus('bean')
      }
    })
  }
}

// 6: 金融钢镚签到
function guangbeng(setting) {
  if (setting != 'never') {
    console.log('签到领京豆（jr-qyy）')
    weui.toast('京价保运行中', 1000);
    chrome.runtime.sendMessage({
      text: "run_status",
      jobId: "6"
    })
    if ($(".gangbeng .btn").text() == "签到") {
      simulateClick($(".gangbeng .btn"))
      // 监控结果
      setTimeout(function () {
        if (($(".am-modal-body .title").text() && $(".am-modal-body .title").text().indexOf("获得") > -1) ) {
          let re = /^[^-0-9.]+([0-9.]+)[^0-9.]+$/
          let rawValue = $(".am-modal-body .title").text()
          let value = re.exec(rawValue)
          markCheckinStatus('jr-qyy', (value ? value[1] : '～0.01') + '个钢镚', () => {
            chrome.runtime.sendMessage({
              text: "checkin_notice",
              title: "京价保自动为您签到抢钢镚",
              value: value ? value[1] : 0.01,
              unit: 'coin',
              content: "恭喜您领到了" + (value ? value[1] : '～0.01') + "个钢镚"
            }, function(response) {
              console.log("Response: ", response);
            })
          })
        }
      }, 1000)
    } else {
      if ($(".gangbeng .btn").text() == "已签到") {
        markCheckinStatus('jr-qyy')
      }
    }
  }
}

// 9: 金融会员签到
function jrIndex(setting) {
  if (setting != 'never') {
    console.log('签到领京豆（jr-index)')
    weui.toast('京价保运行中', 1000);
    chrome.runtime.sendMessage({
      text: "run_status",
      jobId: "9"
    })
    if ($("#sign2main .sign-btn").length > 0 && $("#sign2main .sign-btn").text().indexOf('签到') > -1) {
      simulateClick($("#sign2main .sign-btn"), true)
      // 监控结果
      setTimeout(function () {
        if ($("#fengkong .goldcolor").text() && $("#fengkong .goldcolor").text() > 0 ) {
          let rawValue = $("#fengkong .goldcolor").text()
          let coin = priceFormatter(rawValue)
          markCheckinStatus('jr-index', coin + "个钢镚", () => {
            chrome.runtime.sendMessage({
              text: "checkin_notice",
              title: "京价保自动为您签到京东金融",
              value: Number(rawValue),
              unit: 'coin',
              content: "恭喜您！领到了" + coin + "个钢镚"
            }, function (response) {
              console.log("Response: ", response);
            })
          })
        }
        console.log($(".jr-dialog").text())
      }, 1000)
    } else {
      if ($("#sign2main .sign-btn").text().indexOf('再签') == 0) {
        markCheckinStatus('jr-index')
      }
    }
  }
}


// ************
// 主体任务
// ************

var pageTaskRunning = false

function CheckDom() {
  pageTaskRunning = true
  // 转存账号
  resaveAccount()
  // PC 是否登录
  if ($("#ttbar-login .nickname") && $("#ttbar-login .nickname").length > 0 || $("#J_user .user_show .user_logout").length > 0) {
    console.log('PC 已经登录')
    chrome.runtime.sendMessage({
      action: "saveLoginState",
      state: "alive",
      message: "PC网页检测到用户名",
      type: "pc"
    }, function(response) {
      console.log("Response: ", response);
    });
  };

  // M 是否登录
  if (($("#mCommonMy") && $("#mCommonMy").length > 0 && $("#mCommonMy").attr("report-eventid") == "MCommonBottom_My") || ($("#userName") && $("#userName").length > 0) || ($(".user_info .name").text() && $(".user_info .name").text().length > 0)) {
    console.log('M 已经登录')
    chrome.runtime.sendMessage({
      action: "saveLoginState",
      state: "alive",
      message: "移动网页检测到登录",
      type: "m"
    }, function(response) {
      console.log("Response: ", response);
    });
  };

  // 是否是PLUS会员
  if ($(".cw-user .fm-icon").size() > 0 && $(".cw-user .fm-icon").text() == '正式会员') {
    chrome.runtime.sendMessage({
      action: "setVariable",
      key: "jjb_plus",
      value: "Y"
    }, function (response) {
      console.log("Response: ", response);
    });
  }

  // 账号登录页
  dealLoginPage()

  // 移除遮罩
  if ($("#pcprompt-viewpc").size() > 0) {
    simulateClick($("#pcprompt-viewpc"))
  }

  // 商品页
  if (window.location.host == 'item.jd.com' || window.location.host == 're.jd.com') {
    getSetting('disable_pricechart', showPriceChart);
    if (window.location.host == 'item.jd.com') {
      setTimeout(() => {
        let priceInfo = seekPriceInfo('pc');
        getSetting('hand_protection', (setting) => {
          handProtection(setting, priceInfo)
        })
      }, 1500);
    }
  }

  // 移动商品页
  if (window.location.host == 'item.m.jd.com') {
    setTimeout(() => {
      seekPriceInfo();
    }, 500);
  }

  // PC价保
  if (window.location.host == 'pcsitepp-fm.jd.com' || window.location.host == 'msitepp-fm.jd.com') {
    getSetting('job1_frequency', priceProtect)
  }

  // 移动页增加滑动支持
  if (window.location.host == 'm.jd.com' || window.location.host == 'plogin.m.jd.com' || window.location.host == 'm.jr.jd.com') {
    injectScript(chrome.extension.getURL('/static/touch-emulator.js'), 'body');
    injectScriptCode(`
      setTimeout(function () {
        TouchEmulator();
      }, 200)
    `, 'body')
  }

  // 会员页签到 (5:京东会员签到)
  if ($(".sign-pop").length || $(".signin .signin-days").length || window.location.host == 'vip.m.jd.com') {
    getSetting('job5_frequency', vipCheckin)
  };

  // 16 白条签到
  if ($("#lottery .mark_btn_start").length || $("#lottery .mark_btn_start").length > 0) {
    getSetting('job16_frequency', baitiaoLottery)
  };

  // 2 萌犬庄园
  if (window.location.host == 'wqs.jd.com' && window.location.pathname == '/pet-dog/index.html') {
    getSetting('job2_frequency', petDog)
  }

  // 8 种豆得豆
  if (window.location.host == 'bean.m.jd.com' && window.location.pathname == '/plantBean/index.action') {
    getSetting('job8_frequency', plantBean)
  }

  // 10 京东金融新人礼
  // if (window.location.href == 'https://m.jr.jd.com/zc/drawSystem/sohu/index.html?contentParam=100001342') {
	// getSetting('job10_frequency', dailyJDJRXRL)
  // }

  // 12 超市签到有礼
  if (window.location.host == 'pro.m.jd.com' && window.location.pathname == '/mall/active/aNCM6yrzD6qp1Vvh5YTzeJtk7cM/index.html') {
	getSetting('job12_frequency', dailyCSQDYL)
  }

  // 13 小羊毛抽好礼
  if (window.location.host == 'wqs.jd.com' && window.location.pathname == '/wxsq_project/xym/ticketBonus/xym_ticketBonus.html') {
	getSetting('job13_frequency', dailyXYMCHL)
  }

  // 18 京东礼品卡
  if (window.location.host == 'pro.m.jd.com' && window.location.pathname == '/mall/active/2nTmRwG2r7d83rQNumvf5stQzB1h/index.html') {
	getSetting('job18_frequency', dailyJDLPK)
  }

  // 19 白条权益中心
  if (window.location.host == 'workline.jd.com' && window.location.pathname == '/consumer/baitiaohome/index.html') {
	getSetting('job19_frequency', dailyBTQYZX)
  }

  // 20 拍拍二手签到有礼
  if (window.location.host == 'pro.m.jd.com' && window.location.pathname == '/mall/active/3S28janPLYmtFxypu37AYAGgivfp/index.html') {
	getSetting('job20_frequency', dailyPPESQDYL)
  }

  // 21 天天领福利1
  if (window.location.host == 'm.jr.jd.com' &&
	  window.location.pathname == '/spe/acs/hymSystem/index.html' &&
	  window.location.search == '?contentParam=100000318&actCode=3507312A7C&actType=1') {
	getSetting('job21_frequency', dailyTTLFL1)
  }

  // 22 天天领福利2
  if (window.location.host == 'm.jr.jd.com' &&
	  window.location.pathname == '/spe/acs/hymSystem/index.html' &&
	  window.location.search == '?contentParam=100001064&actCode=6C6C995B53&actType=1') {
	getSetting('job22_frequency', dailyTTLFL2)
  }

  // 23 现金红包免费抢
  if (window.location.host == 'm.jr.jd.com' &&
	  window.location.pathname == '/zc/drawSystem/hb/index.html' &&
	  window.location.search == '?contentParam=100000980&act=1&actCode=D52B96ABDB&actType=1') {
	getSetting('job23_frequency', dailyXJHBMFQ)
  }

  // 24 京东财富送惊喜
  if (window.location.host == 'm.jr.jd.com' &&
	  window.location.pathname == '/zc/drawSystem/hb/index.html' &&
	  window.location.search == '?contentParam=100000916&act=1&actCode=73362F6CE2&actType=1') {
	getSetting('job24_frequency', dailyJDCFSJX)
  }

  // 25 每天领钢镚
  if (window.location.host == 'm.jr.jd.com' &&
	  window.location.pathname == '/activity/brief/get5Coin/index2.html') {
	getSetting('job25_frequency', dailyMTLGB)
  }

  // 26 京东用户每日福利
  if (window.location.host == 'wqs.jd.com' &&
	  window.location.pathname == '/promote/201712/mwelfare/m.html') {
	getSetting('job26_frequency', dailyJDYHMRFL)
  }

  // 27 流量加油站
  if (window.location.host == 'fbank.m.jd.com' &&
	  window.location.pathname == '/') {
	getSetting('job27_frequency', dailyLLJYZ)
  }

  // 28 新年钱多多
  if (window.location.host == 'm.jr.jd.com' &&
	  (window.location.pathname.indexOf('/activity/qianduoduo/index') >= 0 ||
	   window.location.pathname.indexOf('/activity/qianduoduo/detail') >= 0 ||
	   window.location.pathname.indexOf('/activity/qianduoduo/summary') >= 0 ||
	   window.location.pathname.indexOf('/activity/qianduoduo/withdraw') >= 0)) {
	getSetting('job28_frequency', dailyXNQDD)
  }

  // 29 翻牌中大奖
  if (window.location.host == 'stock-sr.jd.com' &&
	  window.location.pathname == '/h5/jd-flipDraw/html/index.html') {
	getSetting('job29_frequency', dailyFPZDJ)
  }

  // 30 京东支付单单返
  if (window.location.host == 'm.jr.jd.com' &&
	  window.location.pathname == '/vip/activity/newperback/index.html') {
	getSetting('job30_frequency', dailyJDZFDDF)
  }

  // 31 双签领奖励
  if (window.location.host == 'm.jr.jd.com' &&
	  window.location.pathname == '/integrate/signin/index.html') {
	getSetting('job31_frequency', dailySQLJL)
  }

  // 32 白条额度
  if (window.location.host == 'm.jr.jd.com' &&
	  window.location.pathname == '/mjractivity/rn/rn_bt_raise/index.html') {
	getSetting('job32_frequency', dailyBTED)
  }

  // 33 免费领健康保障金
  if (window.location.host == 'm.jr.jd.com' &&
	  window.location.pathname == '/bzx/jkx/index.html') {
	getSetting('job33_frequency', dailyMFLJKBZJ)
  }

  // 34 京豆大转盘
  if (window.location.host == 'turntable.m.jd.com' &&
	  window.location.pathname == '/' &&
	  window.location.search == '?actId=jgpqtzjhvaoym') { // search 参数很重要！！！
	getSetting('job34_frequency', dailyJDDZP)
  }

  // 17 小羊毛
  if (document.title == "小羊毛领京豆红包" && window.location.host == 'wqs.jd.com') {
    getSetting('job17_frequency', dailyJDBeans)
  }

  // 京豆签到 (11:京豆签到)
  if (window.location.host == 'bean.m.jd.com' && window.location.pathname == '/') {
    getSetting('job11_frequency', beanCheckin)
  };

  // 京东金融慧赚钱签到 (6:金融慧赚钱签到)
  if ($(".assets-wrap .gangbeng").size() > 0) {
    getSetting('job6_frequency', guangbeng)
  };

  // 钢镚签到 (14:钢镚签到)
  if (window.location.origin == "https://coin.jd.com" && window.location.pathname == "/m/gb/index.html") {
    injectScriptCode(`
      function canvasEventListener() {
        let canvas = $("#myCanvas")[0];
        canvas.addEventListener('touchstart', canvas.ontouchstart);
        canvas.addEventListener('touchmove', canvas.ontouchmove);
        canvas.addEventListener('touchend', canvas.ontouchend);
      };
      canvasEventListener();
    `, 'body')
    setTimeout(() => {
      getSetting('job14_frequency', getCoin);
    }, 1000);
  };

  // 京东金融首页签到（9： 金融会员签到）
  if ($("#sign2main .sign-btn").size() > 0) {
    getSetting('job9_frequency', jrIndex);
  };

  // 领取 PLUS 券（3： PLUS券）
  if ( $(".coupon-swiper .coupon-item").length > 0 ) {
    getSetting('job3_frequency', getPlusCoupon)
  };

  // 单独的领券页面
  if ( $("#js_detail .coupon_get") && $(".coupon_get .js_getCoupon").length > 0) {
    console.log('单独的领券页面', $("#js_detail .coupon_get").find('.js_getCoupon'))
    $("#js_detail .coupon_get").find('.js_getCoupon').trigger( "tap" )
    $("#js_detail .coupon_get").find('.js_getCoupon').trigger( "click" )
  }

  // 领取白条券（4：领白条券）
  if ($("#react-root .react-root .react-view").length > 0 && window.location.host == 'm.jr.jd.com' && document.title == "领券中心") {
    getSetting('job4_frequency', CheckBaitiaoCouponDom)
  };

  // 全品类券
  if ($("#quanlist").length > 0 && window.location.host == 'a.jd.com') {
    getSetting('job15_frequency', getCommonUseCoupon)
  };

  // 自动访问店铺领京豆
  if ( $(".bean-shop-list").length > 0 ) {
    getSetting('job7_frequency', autoVisitShop)
  };


  if ($(".jShopHeaderArea").length > 0 && $(".jShopHeaderArea .jSign .unsigned").length > 0) {
    getSetting('job7_frequency', doShopSign)
  }

  if ($(".jShopHeaderArea").length > 0 && $(".jShopHeaderArea .jSign .signed").length > 0) {
    chrome.runtime.sendMessage({
      text: "remove_tab",
      content: JSON.stringify({
        url: window.location.href,
        pinned: "true"
      })
    }, function(response) {
      console.log("Response: ", response);
    });
  }

  // 领取精选券
  if ($(".coupon_sec_body").length > 0) {
    getSetting('job2_frequency', pickupCoupon)
  };

  // 自动跳转至商品页面
  if ($(".shop_intro .gobuy").length > 0) {
    showUtmSource()
    getSetting('auto_gobuy', autoGobuy)
  };

  // 手机验证码
  if ($('.tip-box').size() > 0 && $(".tip-box").text().indexOf("账户存在风险") > -1) {
    dealLoginFailed("pc", "需要手机验证码")
    chrome.runtime.sendMessage({
      text: "highlightTab",
      content: JSON.stringify({
        url: window.location.href,
        pinned: "true"
      })
    }, function(response) {
      console.log("Response: ", response);
    });
  }

  // 验证码
  if ($('.page-notice .txt-end').size() > 0 && $('.page-notice .txt-end').text().indexOf("账户存在风险") > -1) {
    dealLoginFailed("m", "需要手机验证码")
  }

  // go to user page
  if (window.location != window.parent.location) {
    setTimeout(() => {
      if ($("#mCommonCart").size() > 0) {
        simulateClick($("#mCommonCart"), true)
      }
      if ($("#m_common_header_shortcut_h_home").size() > 0) {
        simulateClick($("#m_common_header_shortcut_h_home"), true)
      }
      if ($("#ttbar-myjd a").size() > 0) {
        $("#ttbar-myjd a").attr('target', '_self')
        simulateClick($("#ttbar-myjd a"), true)
      }
    }, 2 * 60 * 1000);
  }
}

$( document ).ready(function() {
  console.log('京价保注入页面成功');
  if (!pageTaskRunning) {
    setTimeout( function(){
      console.log('京价保开始执行任务');
      CheckDom()
    }, 1000)
  }
});

// 消息
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  switch (message.action) {
    case 'productPrice':
      findOrderBySkuAndApply(message, message.setting)
      sendResponse({
        gotcha: message
      })
      break;
    default:
      break;
  }
});

var passiveSupported = false;
try {
  var options = Object.defineProperty({}, "passive", {
    get: function() {
      passiveSupported = true;
    }
  });

  window.addEventListener("test", null, options);
} catch(err) {}

window.addEventListener("message", function(event) {
    if (event.data && event.data.action == 'productPrice') {
      findOrderBySkuAndApply(event.data, event.data.setting)
    }
  },
  passiveSupported ? { passive: true } : false
);


var nodeList = document.querySelectorAll('script');
for (var i = 0; i < nodeList.length; ++i) {
  var node = nodeList[i];
  node.src = node.src.replace("http://", "https://")
}