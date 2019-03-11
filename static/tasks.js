import {getLoginState} from './account'

module.exports = {
  priceProUrl: "https://msitepp-fm.jd.com/rest/priceprophone/priceProPhoneMenu",
  frequencyOptionText: {
    '2h': "每2小时",
    '5h': "每5小时",
    'daily': "每天",
    'never': "从不"
  },
  mapFrequency: {
    '2h': 2 * 60,
    '5h': 5 * 60,
    'daily': 24 * 60,
    'never': 99999
  },
  tasks: [
    {
      id: '1',
      src: {
        m: "https://msitepp-fm.jd.com/rest/priceprophone/priceProPhoneMenu",
        pc: "https://pcsitepp-fm.jd.com/rest/pricepro/priceapply"
      },
      title: '价格保护',
      description: "价格保护默认只申请15天内下单的商品",
      mode: 'iframe',
      type: ['m', 'pc'],
      frequencyOption: ['2h', '5h', 'daily', 'never'],
      frequency: '5h'
    },
    {
      id: '15',
      src: {
        pc: 'https://jjb.zaoshu.so/event/coupon',
      },
      url: 'https://a.jd.com',
      title: '全品类券',
      description: "每天整天领取全平台通用券（105减5/500减20/1000减30）",
      schedule: [10,11,12,13,14,15,16,17,18,19,20,21,22,23,24],
      mode: 'iframe',
      type: ['pc'],
      frequencyOption: ['2h', '5h', 'daily', 'never'],
      frequency: '2h'
    },
    {
      id: '3',
      src: {
        m: 'https://plus.m.jd.com/index',
      },
      title: 'PLUS券',
      description: "当然啦，你得先是PLUS会员才能领到",
      mode: 'iframe',
      frequencyOption: ['2h', '5h', 'daily', 'never'],
      type: ['m'],
      frequency: '5h'
    },
    {
      id: '4',
      src: {
        m: 'https://m.jr.jd.com/mjractivity/rn/couponCenter/index.html?RN=couponCenter&tab=20',
      },
      title: '白条券',
      mode: 'iframe',
      frequencyOption: ['2h', '5h', 'daily', 'never'],
      type: ['m'],
      frequency: '5h'
    },
    {
      id: '5',
      src: {
        m: 'https://vip.m.jd.com/page/signin',
      },
      title: '京东会员签到',
      description: "京东会员移动页每日签到领京豆",
      mode: 'iframe',
      key: "vip",
      type: ['m'],
      checkin: true,
      frequencyOption: ['daily', 'never'],
      frequency: 'daily'
    },
    {
      id: '14',
      src: {
        m: 'https://coin.jd.com/m/gb/index.html',
      },
      title: '钢镚每日签到',
      key: "coin",
      checkin: true,
      mode: 'iframe',
      type: ['m'],
      frequencyOption: ['daily', 'never'],
      frequency: 'daily'
    },
    {
      id: '6',
      src: {
        m: 'https://m.jr.jd.com/spe/qyy/main/index.html?userType=41',
      },
      title: '金融钢镚签到',
      description: "京东金融惠赚钱每日签到有钢镚奖励",
      key: "jr-qyy",
      mode: 'iframe',
      type: ['m'],
      checkin: true,
      frequencyOption: ['daily', 'never'],
      frequency: 'daily'
    },
    {
      id: '9',
      src: {
        m: 'https://m.jr.jd.com/vip/sign/html/index.html',
      },
      title: '金融会员签到',
      description: "京东金融会员签到，需要实名认证",
      key: "jr-index",
      checkin: true,
      mode: 'iframe',
      type: ['m'],
      frequencyOption: ['daily', 'never'],
      frequency: 'daily'
    },
    {
      id: '11',
      src: {
        m: 'https://bean.m.jd.com',
      },
      title: '每日京豆签到',
      key: "bean",
      checkin: true,
      mode: 'iframe',
      type: ['m'],
      frequencyOption: ['daily', 'never'],
      frequency: 'daily'
    },
    {
      id: '16',
      src: {
        m: 'https://m.jr.jd.com/btyingxiao/marketing/html/index.html',
      },
      title: '每日白条抽奖',
      description: "大部分情况获得京豆，也有可能白条券",
      key: "baitiao",
      checkin: true,
      mode: 'iframe',
      type: ['m'],
      frequencyOption: ['daily', 'never'],
      frequency: 'daily'
    },
    {
      id: '17',
      src: {
        m: 'https://wqs.jd.com/wxsq_project/xym/dailyJDBeans/xym_dailyJDBeans.html',
      },
      title: '京东京豆红包',
      description: "小羊毛领京豆红包",
      key: "xym",
      mode: 'iframe',
      type: ['m'],
      checkin: true,
      frequencyOption: ['daily', 'never'],
      frequency: 'daily'
    },
    {
      id: '7',
      src: {
        pc: 'https://bean.jd.com/myJingBean/list',
      },
      title: '浏览店铺签到',
      description: "这个功能是自动浏览店铺签到得京豆，会开一些固定标签页",
      mode: 'tab',
      type: ['pc'],
      frequencyOption: ['daily', 'never'],
      frequency: 'never'
    }
,{id:"2",src:{m:"https://wqs.jd.com/pet-dog/index.html"},title:'萌犬庄园',description:"萌犬庄园养狗",key:"petdog",mode:'iframe',type:['m'],checkin:true,frequencyOption:['30m','never'],frequency:'30m'}
,{id:"8",src:{m:"https://bean.m.jd.com/plantBean/index.action"},title:'种豆得豆',description:"种豆得京豆",key:"plantbean",mode:'iframe',type:['m'],checkin:true,frequencyOption:['30m','never'],frequency:'30m'}
,{id:"18",src:{m:"https://pro.m.jd.com/mall/active/2nTmRwG2r7d83rQNumvf5stQzB1h/index.html"},title:'京东礼品卡',description:"京东礼品卡",key:"jdlpk",mode:'iframe',type:['m'],checkin:true,frequencyOption:['daily','never'],frequency:'daily'}
,{id:"19",src:{m:"https://workline.jd.com/consumer/baitiaohome/index.html"},title:'白条权益中心',description:"白条权益中心",key:"btqyzx",mode:'iframe',type:['m'],checkin:true,frequencyOption:['daily','never'],frequency:'daily'}
,{id:"20",src:{m:"https://pro.m.jd.com/mall/active/3S28janPLYmtFxypu37AYAGgivfp/index.html"},title:'拍拍二手签到有礼',description:"拍拍二手签到有礼",key:"ppesqdyl",mode:'iframe',type:['m'],checkin:true,frequencyOption:['daily','never'],frequency:'daily'}
// ,{id:"21",src:{m:"https://m.jr.jd.com/spe/acs/hymSystem/index.html?contentParam=100000318&actCode=3507312A7C&actType=1"},title:'天天领福利1',description:"天天领福利1",key:"ttlfl1",mode:'iframe',type:['m'],checkin:true,frequencyOption:['daily','never'],frequency:'never'}
// ,{id:"22",src:{m:"https://m.jr.jd.com/spe/acs/hymSystem/index.html?contentParam=100001064&actCode=6C6C995B53&actType=1"},title:'天天领福利2',description:"天天领福利2",key:"ttlfl2",mode:'iframe',type:['m'],checkin:true,frequencyOption:['daily','never'],frequency:'never'}
// ,{id:"23",src:{m:"https://m.jr.jd.com/zc/drawSystem/hb/index.html?contentParam=100000980&act=1&actCode=D52B96ABDB&actType=1"},title:'现金红包免费抢',description:"现金红包免费抢",key:"xjhbmfq",mode:'iframe',type:['m'],checkin:true,frequencyOption:['daily','never'],frequency:'never'}
// ,{id:"24",src:{m:"https://m.jr.jd.com/zc/drawSystem/hb/index.html?contentParam=100000916&act=1&actCode=73362F6CE2&actType=1"},title:'京东财富送惊喜',description:"京东财富送惊喜",key:"jdcfsjx",mode:'iframe',type:['m'],checkin:true,frequencyOption:['daily','never'],frequency:'never'}
,{id:"25",src:{m:"https://m.jr.jd.com/activity/brief/get5Coin/index2.html"},title:'每天领钢镚',description:"每天领钢镚",key:"mtlgb",mode:'iframe',type:['m'],checkin:true,frequencyOption:['daily','never'],frequency:'daily'}
,{id:"26",src:{m:"https://wqs.jd.com/promote/201712/mwelfare/m.html"},title:'京东用户每日福利',description:"京东用户每日福利",key:"jdyhmrfl",mode:'iframe',type:['m'],checkin:true,frequencyOption:['30m','never'],frequency:'30m'}
,{id:"27",src:{m:"https://fbank.m.jd.com/"},title:'流量加油站',description:"流量加油站",key:"lljyz",mode:'iframe',type:['m'],checkin:true,frequencyOption:['daily','never'],frequency:'daily'}
,{id:"28",src:{m:"https://m.jr.jd.com/activity/qianduoduo/index/"},title:'新年钱多多',description:"新年钱多多",key:"xnqdd",mode:'iframe',type:['m'],checkin:true,frequencyOption:['daily','never'],frequency:'daily'}
,{id:"29",src:{m:"https://stock-sr.jd.com/h5/jd-flipDraw/html/index.html"},title:'翻牌中大奖',description:"翻牌中大奖",key:"fpzdj",mode:'iframe',type:['m'],checkin:true,frequencyOption:['daily','never'],frequency:'daily'}
,{id:"30",src:{m:"https://m.jr.jd.com/vip/activity/newperback/index.html"},title:'京东支付单单返',description:"京东支付单单返",key:"jdzfddf",mode:'iframe',type:['m'],checkin:true,frequencyOption:['daily','never'],frequency:'daily'}
// ,{id:"31",src:{m:"https://m.jr.jd.com/integrate/signin/index.html"},title:'双签领奖励',description:"双签领奖励",key:"sqljl",mode:'iframe',type:['m'],checkin:true,frequencyOption:['daily','never'],frequency:'never'}
,{id:"32",src:{m:"https://m.jr.jd.com/mjractivity/rn/rn_bt_raise/index.html"},title:'白条额度',description:"白条额度",key:"bted",mode:'iframe',type:['m'],checkin:true,frequencyOption:['daily','never'],frequency:'daily'}
,{id:"33",src:{m:"https://m.jr.jd.com/bzx/jkx/index.html"},title:'免费领健康保障金',description:"免费领健康保障金",key:"mfljkbzj",mode:'iframe',type:['m'],checkin:true,frequencyOption:['daily','never'],frequency:'daily'}
  ],
  // 根据登录状态选择任务模式
  findJobPlatform: function (job) {
    let loginState = getLoginState()
    let platform = null
    for (var i = 0; i < job.type.length; i++) {
      if (loginState[job.type[i]].state == 'alive') {
        platform = job.type[i];
        break;
      }
    }
    return platform
  }
};