import * as _ from "lodash"
$ = window.$ = window.jQuery = require('jquery')
import {DateTime} from 'luxon'
import tippy from 'tippy.js'
import weui from 'weui.js'
import Vue from '../node_modules/vue/dist/vue.esm.js'

import {tasks, frequencyOptionText, findJobPlatform} from './tasks'
import {getSetting, versionCompare, readableTime} from './utils'
import {getLoginState} from './account'

function tippyElement(el) {
  setTimeout(() => {
    let title = el.getAttribute('title')
    if (title) {
      tippy(el, {
        content: title
      })
    }
  }, 10);
}

Vue.directive('tippy', {
  componentUpdated: tippyElement,
  inserted: tippyElement
})

Vue.directive('autoSave', {
  bind(el, binding) {
    function revertValue(el) {
      let current = getSetting(el.name, null);
      if (el.type == 'checkbox') {
        if (current == "checked") {
          el.checked = true
        } else {
          el.checked = false
        }
      } else if (el.type == 'select-one'){
        el.value = current || el.options[0].value
      } else {
        el.value = current
      }
    }
    function saveToLocalStorage(el, binding) {
      if (el.type == 'checkbox') {
        if (el.checked) {
          localStorage.setItem(el.name, "checked")
        } else {
          localStorage.removeItem(el.name)
        }
        if (binding.value.bindData) {
          popupVM[binding.value.bindData] = el.checked
        }
      } else {
        localStorage.setItem(el.name, el.value)
      }
      weui.toast("设置已保存", 500)
    }
    revertValue(el)
    el.addEventListener('change', function(event) {
      if (binding.value && binding.value.notice && el.checked) {
        weui.confirm(binding.value.notice, function(){
          saveToLocalStorage(el, binding)
        }, function(){
          event.preventDefault();
          setTimeout(() => {
            revertValue(el)
          }, 50);
        }, {
          title: '选项确认'
        });
      } else {
        saveToLocalStorage(el, binding)
      }
    });
  }
})

$.each(['show', 'hide'], function (i, ev) {
  var el = $.fn[ev];
  $.fn[ev] = function () {
    this.trigger(ev);
    return el.apply(this, arguments);
  };
});

let rewards = [
  '给开发者加个鸡腿',
  '请开发者喝杯咖啡',
  '京价保就是好',
  '保价成功，感谢开发者',
  '返利到手，打赏开发者',
  '赞赏支持',
  '打赏声优'
]

let notices = [
  {
    text: '成功申请到价保、领取到返利或者有功能建议欢迎打赏附言。',
    type: 'reward',
    button: rewards[3],
    target: 'ming'
  },
  {
    text: '理想情况下京价保每月仅各种签到任务即可带来5元以上的等同现金收益。',
    button: rewards[2],
    type: 'reward',
    target: 'ming'
  },
  {
    text: '京东页面经常修改，唯有你的支持才能让京价保保持更新持续运作。',
    button: rewards[5],
    type: 'reward',
    target: 'ming'
  },
  {
    text: '京东的登录有效期很短，请在登录时勾选保存密码自动登录以便京价保自动完成工作。',
    button: rewards[0],
    type: 'reward',
    target: 'ming'
  },
  {
    text: '京价保全部代码已上传到GitHub，欢迎审查代码，了解京价保如何工作。',
    button: rewards[0],
    type: 'reward',
    target: 'ming'
  },
  {
    text: '软件开发需要开发者付出劳动和智慧，每一行代码都要付出相应的工作，并非唾手可得。',
    button: rewards[5],
    type: 'reward',
    target: 'ming'
  },
  {
    text: '京价保并不强制付费，但如果它确实帮到你，希望你也能帮助它保持更新。',
    button: rewards[5],
    type: 'reward',
    target: 'ming'
  },
  {
    text: '许多开源项目因为缺乏支持而停止更新，如果你希望京价保保持更新，请赞赏支持。',
    button: rewards[5],
    type: 'reward',
    target: 'ming'
  },
  {
    text: '如果你的京东账号修改了密码，请在高级设置中选择清除密码重新登录来继续使用京价保',
    button: rewards[5],
    type: 'reward',
    target: 'ming'
  },
  {
    text: '把京价保推荐给你的朋友同样能帮助京价保保持更新，如果缺乏使用者，开发者可能会放弃维护项目。',
    button: rewards[2],
    type: 'reward',
    target: 'ming'
  },
  {
    text: '如果价保成功的话，打赏声优小姐姐几块钱她会很开心哦',
    button: rewards[6],
    type: 'reward',
    target: 'samedi'
  }
]

let recommendServices = [
  {
    link: "https://cloud.tencent.com/redirect.php?redirect=1025&cps_key=8c3eff7793dd70781315d9b5c9727c39&from=console",
    title: "腾讯云新客礼包",
    description: "新客户无门槛领取2775元代金券",
    class: "el-tag el-tag--success"
  },
  {
    link: "https://www.boslife.me/aff.php?aff=435",
    title: "科学上网服务",
    description: "小明使用2年的科学上网服务",
    class: "el-tag el-tag--warning"
  },
  {
    link: "https://promotion.aliyun.com/ntms/yunparter/invite.html?userCode=sqj7d3bm",
    title: "阿里云优惠券",
    description: "领取阿里云全品类优惠券",
    class: "el-tag"
  },
]

var popupVM = new Vue({
  el: '#popup',
  data: {
    tasks: [],
    messages: [],
    orders: [],
    skuPriceList: {},
    recommendedLinks: [],
    newDiscounts: false,
    loadingOrder: false,
    frequencyOptionText: frequencyOptionText,
    recommendServices: getSetting('recommendServices', recommendServices),
    currentVersion: '{{version}}',
    newChangelog: (versionCompare(getSetting('changelog_version', '2.0'), '{{version}}') < 0),
    hiddenOrderIds: getSetting('hiddenOrderIds', []),
    hiddenPromotionIds: getSetting('hiddenPromotionIds', []),
    disabled_link: getSetting('disabled_link') == 'checked' ? true : false,
    selectedTab: null,
    discountList: null,
    newVersion: getSetting('newVersion', null),
    numbers: [ 1, 2, 3, 4, 5 ],
    loginState: {
      default: true,
      m: {
        state: "unknown"
      },
      pc: {
        state: "unknown"
      }
    }
  },
  mounted: async function () {
    // 查询最新优惠
    let response = await fetch("https://jjb.zaoshu.so/discount/last")
    let lastDiscount = await response.json();
    let readDiscountAt = localStorage.getItem('readDiscountAt')
    if (!readDiscountAt || new Date(lastDiscount.createdAt) > new Date(readDiscountAt)) {
      this.newDiscounts = true
    }
  },
  watch: {
    loginState: function (newState, oldState) {
      if (oldState.m.state != "alive" && oldState.pc.state != "alive" && !oldState.default) {
        if (newState.m.state == "alive" || newState.pc.state == "alive") {
          if (this.orders.length < 1) {
            this.loadingOrder = true
            this.retryTask(tasks[0], true)
          }
        }
      }
    }
  },
  methods: {
    showLoginState: function () {
      $("#loginNotice").show()
    },
    retryTask: function (task, hideNotice = false) {
      chrome.runtime.sendMessage({
        action: "runTask",
        hideNotice: hideNotice,
        taskId: task.id
      }, function(response) {
        if (!hideNotice) {
          weui.toast('手动运行成功', 3000);
        }
      });
    },
    backup_picture: function (e) {
      e.currentTarget.src = "https://jjbcdn.zaoshu.so/web/img_error.png"
    },
    selectType: function (type) {
      this.selectedTab = type
    },
    dismiss: function (order) {
      this.hiddenPromotionIds.push(order.id)
      localStorage.setItem('hiddenPromotionIds', JSON.stringify(this.hiddenPromotionIds))
      this.$forceUpdate()
    },
    getDiscounts: async function () {
      this.newDiscounts = false
      let response = await fetch("https://jjb.zaoshu.so/discount")
      let discounts = await response.json();
      this.discountList = discounts.map(function (discount) {
        discount.displayTime = readableTime(DateTime.fromISO(discount.createdAt))
        return discount
      })
      localStorage.setItem('readDiscountAt', new Date())
      this.$forceUpdate()
    },
    toggleOrder: function (order) {
      if (_.indexOf(this.hiddenOrderIds, order.id) > -1) {
        this.hiddenOrderIds = _.pull(this.hiddenOrderIds, order.id);
      } else {
        this.hiddenOrderIds.push(order.id)
      }
      localStorage.setItem('hiddenOrderIds', JSON.stringify(this.hiddenOrderIds))
      this.$forceUpdate()
    },
    showChangelog: function () {
      this.newChangelog = false
      localStorage.setItem('changelog_version', $(this).data('version'))
      weui.dialog({
        title: '更新记录',
        content: `<iframe id="changelogIframe" frameborder="0" src="https://jjb.zaoshu.so/changelog?buildId={{buildid}}&browser={{browser}}" style="width: 100%;min-height: 350px;"></iframe>`,
        className: 'changelog',
        buttons: [{
          label: '完成',
          type: 'primary'
        }]
      })
    }
  }
})


// 接收消息
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  switch (message.action) {
    case 'orders_updated':
      let orders = JSON.parse(message.data).map(function (order) {
        order.displayTime = readableTime(DateTime.fromISO(order.time))
        return order
      })
      popupVM.orders = orders
      break;
    case 'new_message':
      let lastUnreadCount = $("#unreadCount").text()
      $("#unreadCount").text(Number(lastUnreadCount) + 1).fadeIn()
      popupVM.messages = makeupMessages(JSON.parse(message.data))
      break;
    case 'loginState_updated':
      dealWithLoginState()
      break;
    default:
      break;
  }
});

function switchWechat(target) {
  let to = target || 'ming'
  if (to == 'samedi') {
    $("#dialogs .weixin_pay .ming").hide()
    $("#dialogs .weixin_pay .samedi").show()
  } else {
    $("#dialogs .weixin_pay .ming").show()
    $("#dialogs .weixin_pay .samedi").hide()
  }
}

function switchAlipay(target) {
  let to = target || ($("#dialogs .alipay_pay .alipay").is(':visible') ? 'redpack' : 'alipay')
  if (to == 'redpack') {
    console.log('show redpack')
    $("#dialogs .alipay_pay .alipay").hide()
    $("#dialogs .alipay_pay .redpack").show()
  } else {
    console.log('show alipay')
    $("#dialogs .alipay_pay .redpack").hide()
    $("#dialogs .alipay_pay .alipay").show()
  }
}

function showReward() {
  switchPayMethod('weixin')
  let time = Date.now().toString()
  if (time[time.length - 1] < 3) {
    setTimeout(() => {
      switchPayMethod('alipay')
    }, 50);
  }
}


function switchPayMethod(payMethod, target) {
  $("#dialogs").show()
  if (payMethod == 'weixin') {
    $('.segmented-control .weixin').addClass('checked')
    $('.segmented-control .alipay').removeClass('checked')
    $('.weixin_pay').show()
    $('.alipay_pay').hide()
    switchWechat(target)
  } else {
    $('.segmented-control .weixin').removeClass('checked')
    $('.segmented-control .alipay').addClass('checked')
    $('.weixin_pay').hide()
    $('.alipay_pay').show()
    switchAlipay(target)
  }
}

// 试听通知
function listenVoice(type, batch) {
  chrome.runtime.sendMessage({
    text: type,
    batch: batch,
    test: true,
    title: "京价保通知试听",
    content: "并没有钱，这只是假象，你不要太当真"
  }, function (response) {
    console.log("Response: ", response);
  });
}

// 换 Tips
function changeTips() {
  let announcements = (localStorage.getItem('announcements') ? JSON.parse(localStorage.getItem('announcements')) : []).concat(notices)
  let tip = announcements[Math.floor(Math.random() * announcements.length)]
  $("#notice").text(tip.text)
  if (tip.type == "reward" && tip.button) {
    $("#notice").removeAttr("href")
    $("#notice").removeAttr("target")
    $(".tips .weui-btn").css("display", "inline-block")
    $(".tips .weui-btn").addClass("switch-paymethod")
    $(".tips .weui-btn").text(tip.button)
    $(".tips .weui-btn").data('target', tip.target)
  }
  if (tip.type == "link") {
    if (tip.button) {
      $(".tips .weui-btn").removeClass("switch-paymethod")
      $(".tips .weui-btn").css("display", "inline-block")
      $(".tips .weui-btn").text(tip.button)
      $(".tips .weui-btn").attr("href", tip.url)
      $(".tips .weui-btn").attr("target", "_blank")
    } else {
      $(".tips .weui-btn").hide()
    }
    $("#notice").attr("href", tip.url)
    $("#notice").attr("target", "_blank")
  }
  if (tip.type == "link" && tip.mode == "mobliepage") {
    if (tip.button) {
      $(".tips .weui-btn").removeClass("switch-paymethod")
      $(".tips .weui-btn").addClass("openMobilePage")
      $(".tips .weui-btn").attr("data-url", tip.url)
      $(".tips .weui-btn").removeAttr("href")
      $(".tips .weui-btn").removeAttr("target")
    }
    $("#notice").removeAttr("href")
    $("#notice").attr("data-url", tip.url)
    $("#notice").addClass("openMobilePage")
  }
}

function showJEvent(rateLimit) {
  if (rateLimit) {
    let today = DateTime.local().toFormat("o")
    let showRecommendState = getSetting('showRecommendState', {
      date: today,
      times: 0
    })
    if (showRecommendState.date == today) {
      if (showRecommendState.times > rateLimit.limit) {
        return console.log('展示次数超限')
      } else {
        showRecommendState.times = showRecommendState.times + 1
      }
    } else {
      showRecommendState.date = today
      showRecommendState.times = 1
    }
    localStorage.setItem('showRecommendState', JSON.stringify(showRecommendState))
  }
  // 加载反馈
  if (!$("#jEventIframe").attr('src') || $("#jEventIframe").attr('src') == '') {
    $("#jEventIframe").attr('src', "https://jjb.zaoshu.so/recommend")
    setTimeout(function () {
      $('.iframe-loading').hide()
    }, 800)
  }
  $("#jEventDialags").show()
}

// 任务列表
function getTaskList() {
  return _.map(tasks, (task) => {
    task.last_run_at = getSetting('job' + task.id + '_lasttime', null)
    task.frequencySetting = getSetting('job' + task.id + '_frequency', task.frequency)
    task.last_run_description = task.last_run_at ?'上次运行： ' + readableTime(DateTime.fromMillis(Number(task.last_run_at))) : '从未执行'
    // 如果是签到任务，则读取签到状态
    if (task.checkin) {
      let checkinRecord = getSetting('jjb_checkin_' + task.key, null)
      if (checkinRecord && checkinRecord.date == DateTime.local().toFormat("o")) {
        task.checked = true
        task.checkin_description = '完成于：' + readableTime(DateTime.fromISO(checkinRecord.time)) + ( checkinRecord.value ? '，领到：' + checkinRecord.value : '')
      }
    }
    // 选择运行平台
    task.platform = findJobPlatform(task)
    if (!task.url) {
      task.url = task.platform ? task.src[task.platform] : task.src[task.type[0]]
    }
    if (!task.platform) {
      task.suspended = true
      task.platform = task.type[0]
    }
    return task
  })
}

// 处理登录状态
function dealWithLoginState() {
  let stateText = {
    "failed": "失败",
    "alive": "有效",
    "unknown": "未知"
  }
  function getStateDescription(loginState, type) {
    return stateText[loginState[type].state] + (loginState[type].message ? `（ ${loginState[type].message} 上次检查： ${readableTime(DateTime.fromISO(loginState[type].time))} ）` : '')
  }
  function dealWithLoginNotice(loginState, type) {
    let loginTypeNoticeDom = $('.login-type_' + type)
    let loginUrl = loginTypeNoticeDom.data("url")
    let stateDescription = "当前登录状态未知，可点击登录"
    if (loginState[type] && loginState[type].state != "unknown") {
      stateDescription = "当前登录状态" + getStateDescription(loginState, type)
    }
    loginTypeNoticeDom.removeClass("alive").removeClass("failed").addClass(loginState[type].state)
    if (loginTypeNoticeDom[0]._tippy) {
      loginTypeNoticeDom[0]._tippy.setContent(stateDescription)
    }
    $('.login-type_' + type + ' .status-text').text(stateText[loginState[type].state])
    if (!loginState[type] || loginState[type].state != "alive") {
      if (loginUrl && type != 'm') {
        loginTypeNoticeDom.attr("href", loginUrl)
        loginTypeNoticeDom.attr("target", "_blank")
      }
    }
  }
  let loginState = getLoginState()
  popupVM.loginState = loginState
  popupVM.tasks = getTaskList()

  dealWithLoginNotice(loginState, 'pc')
  dealWithLoginNotice(loginState, 'm')
  $("#loginState")[0]._tippy.setContent("PC网页版登录" + getStateDescription(loginState, 'pc') + "，移动网页版登录" + getStateDescription(loginState, 'm'))
  $("#loginState").removeClass("alive").removeClass("failed").removeClass("warning")
  $("#loginState").addClass(loginState.class)
  $("#loginNotice").addClass('state-' + loginState.class)
  // 登录提醒
  switch (loginState.class) {
    case "alive":
      $("#loginNotice").hide()
      $("#login").hide()
      $("#loginNotice .title strong").text("太好了，账号登录状态有效")
      break;
    case "warning":
      $("#loginNotice").hide()
      break;
    case "failed":
      $("#loginNotice").show()
      break;
    default:
      break;
  }
}

function makeupMessages(messages) {
  if (messages) {
    return messages.reverse().map(function (message) {
      if (message.type == 'coupon') {
        message.coupon = JSON.parse(message.content)
      }
      message.time = readableTime(DateTime.fromISO(message.time))
      return message
    })
  } else {
    return []
  }
}


function getPromotions(){
  let promotions = getSetting('promotions', [])
  promotions = _.reject(promotions, (promotion) => {
    return DateTime.fromJSDate(new Date(promotion.validDate)) < DateTime.local()
  })
  localStorage.setItem('promotions', JSON.stringify(promotions))
  return promotions
}

function getOrders() {
  let orders = JSON.parse(localStorage.getItem('jjb_orders'))
  let skuPriceList = getSetting('skuPriceList', {})
  if (orders) {
    orders = orders.map(function (order) {
      order.displayTime = readableTime(DateTime.fromISO(order.time))
      return order
    })
  } else {
    orders = []
  }
  let promotions = getPromotions()
  orders.splice(1, 0, ...promotions);
  popupVM.orders = orders
  popupVM.skuPriceList = skuPriceList
}

function getMessages() {
  let messages = JSON.parse(localStorage.getItem('jjb_messages'))
  messages = makeupMessages(messages)
  popupVM.messages = messages
}

$( document ).ready(function() {
  var paid = localStorage.getItem('jjb_paid');
  var account = localStorage.getItem('jjb_account');
  var admission_test = localStorage.getItem('jjb_admission-test')
  var unreadCount = localStorage.getItem('unreadCount') || 0
  const displayRecommend = localStorage.getItem('displayRecommend')
  const displayRecommendRateLimit = getSetting('displayRecommendRateLimit', {
    rate: 7,
    limit: 1
  })
  let windowWidth = Number(document.body.offsetWidth)
  let time = Date.now().toString()
  // 渲染订单
  getOrders()

  // 渲染通知
  getMessages()

  // 渲染设置
  popupVM.tasks = getTaskList()
  popupVM.recommendedLinks = getSetting("recommendedLinks", [])

  // tippy
  tippy('.tippy')

  // 处理登录状态
  dealWithLoginState()

  // 随机显示 Tips
  changeTips()

  $('body').width(windowWidth-1)
  // 窗口 resize
  setTimeout(() => {
    $('body').width(windowWidth)
  }, 100);

  if (unreadCount > 0) {
    $("#unreadCount").text(unreadCount).fadeIn()
  }

  // 查询推荐设置
  $.getJSON("https://jjb.zaoshu.so/recommend/settings", function (json) {
    if (json.display) {
      localStorage.setItem('displayRecommend', json.display)
    }
    if (json.ratelimit) {
      localStorage.setItem('displayRecommendRateLimit', JSON.stringify(json.ratelimit))
    }
    if (json.announcements && json.announcements.length > 0) {
      localStorage.setItem('announcements', JSON.stringify(json.announcements))
    }
    if (json.promotions) {
      localStorage.setItem('promotions', JSON.stringify(json.promotions))
    }
    if (json.recommendedLinks && json.recommendedLinks.length > 0) {
      localStorage.setItem('recommendedLinks', JSON.stringify(json.recommendedLinks))
    } else {
      localStorage.removeItem('recommendedLinks')
    }
    if (json.recommendServices && json.recommendServices.length > 0) {
      localStorage.setItem('recommendServices', JSON.stringify(json.recommendServices))
    }
  });

  // 查询最新版本
  $.getJSON("https://jjb.zaoshu.so/updates?buildid={{buildid}}&browser={{browser}}", function (lastVersion) {
    if (!lastVersion) return localStorage.removeItem('newVersion')
    let skipBuildId = localStorage.getItem('skipBuildId')
    let localBuildId = skipBuildId || "{{buildid}}"
    // 如果有新版
    if (localBuildId < lastVersion.buildId) {
      localStorage.setItem('newVersion', lastVersion.versionCode)
      // 如果新版是主要版本，而且当前版本需要被提示
      if (lastVersion.major && localBuildId < lastVersion.noticeBuildId) {
        let noticeDialog = weui.dialog({
          title: `${lastVersion.title} <span class="dismiss">&times;</span>` || '京价保有版本更新',
          content: `${lastVersion.changelog}
            <div class="changelog">
              <span class="time">${lastVersion.time}</span>` +
             (lastVersion.blogUrl ? `<a class="blog" href="${lastVersion.blogUrl}" target="_blank">了解更多</a>` : '') +
            `</div>`,
          className: 'update',
          buttons: [{
            label: '不再提醒',
            type: 'default',
            onClick: function () {
              localStorage.setItem('skipBuildId', lastVersion.buildId)
            }
          }, {
            label: '下载更新',
            type: 'primary',
            onClick: function () {
              chrome.tabs.create({
                url: lastVersion.downloadUrl || "https://jjb.zaoshu.so/updates/latest?browser={{browser}}"
              })
            }
          }]
        });
        $(".update .dismiss").on("click", function () {
          noticeDialog.hide()
        })
      }
    } else {
      localStorage.removeItem('newVersion')
    }
  });

  // 是否已存在弹窗
  function isNoDialog(){
    return ($(".js_dialog:visible").length < 1) && ($(".weui-dialog:visible").length < 1)
  }

  // 入学考试
  function showTest(target) {
    let testNo = target || '1'
    $("#admissionTest .testbox").hide()
    setTimeout(() => {
      $("#admissionTest .test-" + testNo).show()
    }, 50);
  }

  if (admission_test && admission_test == 'N') {
    $("#admissionTest").show()
    $("img.jjb-official").attr('src', "http://jjbcdn.zaoshu.so/wechat/qrcode_for_gh_21550d50400c_430.jpg")
    $("#admissionTest .answer").on("click", function () {
      let next = $(this).data('next')
      if (next) {
        showTest(next)
      } else {
        $("#admissionTest").hide()
        localStorage.setItem('jjb_admission-test', 'Y');
      }
    })
    $("#admissionTest .dismiss").on("click", function () {
      $("#admissionTest").hide()
      window.close();
    })
    showTest()
  }

  // 常规弹窗延迟200ms
  setTimeout(() => {
    if (paid) {
      $("#dialogs").hide()
    } else {
      if (isNoDialog() && time[time.length - 1] < 4) {
        showReward()
      }
    }
    // 只有在没有弹框 且 打开了推荐 取 1/5 的几率弹出推荐
    if (isNoDialog() && displayRecommend == 'true' && time[time.length - 1] > displayRecommendRateLimit.rate) {
      showJEvent(displayRecommendRateLimit)
    }


    if (!account) {
      $("#clearAccount").addClass('weui-btn_disabled')
    }
  }, 200);


  $('.settings .weui-navbar__item').on('click', function () {
    $(this).addClass('weui-bar__item_on').siblings('.weui-bar__item_on').removeClass('weui-bar__item_on');
    var type = $(this).data('type')
    $('.settings_box').hide()
    $('.settings_box.' + type).show()
  });

  // 授权
  $('.settings .request-permissions-icon').on('click', function () {
    let permissions = $(this).data('permissions')
    chrome.runtime.sendMessage({
      text: "requestPermissions",
      permissions: permissions
    }, function (response) {
      if (response.granted) {
        weui.toast('授权成功', 3000);
      } else {
        weui.alert('授权失败');
      }
    });
  });

  $('.contents .weui-navbar__item').on('click', function () {
    $(this).addClass('weui-bar__item_on').siblings('.weui-bar__item_on').removeClass('weui-bar__item_on');
    var type = $(this).data('type')
    if (type == 'messages') {
      $("#unreadCount").fadeOut()
      chrome.runtime.sendMessage({
        text: "clearUnread"
      }, function (response) {
        console.log("Response: ", response);
      });
    }
    $('.contents-box').hide()
    $('.contents-box.' + type).show()
  });

  $(".weui-dialog__ft a").on("click", function () {
    $("#dialogs").hide()
    $("#listenAudio").hide()
    $("#loginNotice").hide()
    $("#changeLogs").hide()
    if ($(this).data('action') == 'paid') {
      chrome.runtime.sendMessage({
        text: "paid"
      }, function(response) {
        console.log("Response: ", response);
      });
    } else {
      if ($(this).data('action') == 'pay') {
        showReward()
      }
    }
  })

  $("#listen").on("click", function () {
    $("#listenAudio").show()
  })

  $("#know_more").on("click", function () {
    $("#loginNotice .detail").show()
    $("#know_more").hide()
  })

  $(".switch-paymethod").on("click", function () {
    let to = $(this).data('to')
    let target = $(this).data('target')
    if ($(this).hasClass('switch-paymethod')){
      switchPayMethod(to, target)
    }
  })


  $("#openWechatCard").on("click", function () {
    $("img.jjb-official").attr('src', "http://jjbcdn.zaoshu.so/wechat/qrcode_for_gh_21550d50400c_430.jpg")
    $("#wechatDialags").show()
  })

  $("#openjEventCard").on("click", function () {
    showJEvent()
  })

  $(document).on("click", ".openMobilePage", function () {
    chrome.runtime.sendMessage({
      action: "openUrlAsMoblie",
      url: $(this).data('url')
    }, function (response) {
      console.log("Response: ", response);
    });
  })

  $(".showLoginState").on("click", function () {
    $("#loginNotice").show()
  })

  $("#openFeedback").on("click", function () {
    // 加载反馈
    if ($("#feedbackIframe").attr('src') == '') {
      $("#feedbackIframe").attr('src', "https://i.duotai.net/forms/yovwz?version={{version}}")
      setTimeout(function () {
        $('.iframe-loading').hide()
      }, 800)
    }
    $("#feedbackDialags").show()
  })

  $("#openFaq").on("click", function () {
    // 加载反馈
    if ($("#faqIframe").attr('src') == '') {
      $("#faqIframe").attr('src', "https://i.duotai.net/forms/oqyvk/1lpb11l2")
      setTimeout(function () {
        $('.iframe-loading').hide()
      }, 800)
    }
    $("#faqDialags").show()
  })

  $("#clearPinnedTabs").on("click", function () {
    chrome.tabs.query({
      pinned: true
    }, function (tabs) {
      var tabIds = $.map(tabs, function (tab) {
        if (tab && tab.url.indexOf('jd.com') !== -1) {
            return tab.id
        }
      })

      // opera doesn't remove pinned tabs, so lets first unpin
      $.map(tabIds, function (tabId) {
        chrome.tabs.update(tabId, {"pinned":false}, function(theTab){ chrome.tabs.remove(theTab.id); });
      })
    })
  })

  $("#feedbackDialags .js-close").on("click", function () {
    $("#feedbackDialags").hide()
  })

  $("#faqDialags .js-close").on("click", function () {
    $("#faqDialags").hide()
  })

  $("#jEventDialags .js-close").on("click", function () {
    $("#jEventDialags").hide()
  })

  $("#dialogs .js-close").on("click", function () {
    $("#dialogs").hide()
  })

  $("#wechatDialags .js-close").on("click", function () {
    $("#wechatDialags").hide()
  })

  $("#clearAccount").on("click", function () {
    weui.confirm('清除密码将移除本地存储的账号密码、订单记录、消息记录；清除后若需继续使用请重新登录并选择让京价保记住密码', function () {
      localStorage.removeItem('jjb_account')
      localStorage.removeItem('jjb_orders')
      localStorage.removeItem('jjb_messages')
      chrome.tabs.create({
        url: "https://passport.jd.com/uc/login"
      })
    }, function () {
      console.log('取消清除')
    }, {
      title: '清除密码确认'
    });
  })


  $("#login").on("click", function () {
    chrome.runtime.sendMessage({
      text: "openLogin",
    }, function(response) {
      console.log("Response: ", response);
    });
  })

  $("#notice").on("dblclick", function () {
    changeTips()
  })

  $("#pricePro").on("click", function () {
    chrome.runtime.sendMessage({
      text: "openPricePro"
    }, function (response) {
      console.log("Response: ", response);
    })
  })

  $(".listenVoice").on("click", function () {
    listenVoice($(this).data('type'), $(this).data('batch'))
  })

  $(".showApplyAlipayCode").on("click", function () {
    weui.dialog({
      title: '申请支付宝收款码',
      content: `<img src="https://jjbcdn.zaoshu.so/chrome/applyAlipayCode.jpg" style="width: 270px;"></img>`,
      className: 'apply-alipay-code',
      buttons: [{
        label: '完成',
        type: 'primary'
      }]
    })
  })

})

// 防止缩放
chrome.tabs.getZoomSettings(function (zoomSettings) {
  if (zoomSettings.defaultZoomFactor > 1 && zoomSettings.scope == 'per-origin' && zoomSettings.mode == 'automatic') {
    let zoomPercent = (100 / (zoomSettings.defaultZoomFactor * 100)) * 100;
    document.body.style.zoom = zoomPercent + '%'
  }
})
