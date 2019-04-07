const HuActions = require('./HuActions')
const HuTypes = require('./HuTypes')
const Actions = require('./Actions')
const _ = require('underscore')

const HuXiUtil = {}

/**
 * @param {*} cardsOnGroup
 * @param {*} huAcation
 * @param {boolean} [isLatestCard=false]
 * @returns {*} {hx: 20, hts: [], thx: 100}
 */
HuXiUtil.getHuXi = function (cardsOnGroup, huAcation, isLatestCard = false) {
  var huXi = { hx: 0, hts: [] }
  switch (huAcation) {
    case HuActions.Is3Ti5KanCard: // 天胡
    case HuActions.IsZhuangCard: // 天胡
      huXi.hx = 100
      huXi.hts.push(HuTypes.TianHu)
      huXi.hts.push(HuTypes.ZiMo)
      break;
    case HuActions.IsZhuangFirstOutCard: // 地胡
      huXi.hx = 100
      huXi.hts.push(HuTypes.DiHu)
      huXi.hts.push(HuTypes.FangPao)
      break
    case HuActions.IsMeFlopCard: // 自摸
      huXi.hx = HuXiUtil.getAllGroupHuXi(cardsOnGroup)
      huXi.hts.push(HuTypes.ZiMo)
      HuXiUtil.checkWuHu(cardsOnGroup, huXi, isLatestCard)
      break
    case HuActions.IsOtherFlopCard: // 平胡
      huXi.hx = HuXiUtil.getAllGroupHuXi(cardsOnGroup)
      HuXiUtil.checkWuHu(cardsOnGroup, huXi, isLatestCard)
      break
    case HuActions.IsOtherOutCard: // 放炮
      huXi.hx = HuXiUtil.getAllGroupHuXi(cardsOnGroup)
      huXi.hts.push(HuTypes.FangPao)
      HuXiUtil.checkWuHu(cardsOnGroup, huXi, isLatestCard)
      break
    default:
      break;
  }
  huXi.thx = HuXiUtil.getTotalHuXi(huXi)
  console.log('HuXi...', JSON.stringify(cardsOnGroup), JSON.stringify(huXi))
  return huXi
}

HuXiUtil.getAllGroupHuXi = function (allGroup) {
  var totalHuXi = 0
  allGroup.forEach(group => {
    const huXi = HuXiUtil.getGroupHuXi(group)
    group.huXi = huXi
    totalHuXi = totalHuXi + huXi
  })
  return totalHuXi
}

HuXiUtil.getGroupHuXi = function (group) {
  var cards = group.cards
  var type = group.name
  var huxi = 0;
  if ((_.union(cards, [])).length === 1) {
    // 1. 四张大牌--提 12 胡息
    // 2. 四张小牌--提 9 胡
    // 3. 四张大牌--跑 9 胡息
    // 4. 四张小牌--跑 6 胡
    if (cards.length === 4) {
      switch (type) {
        case Actions.Ti:
          if (cards[0] > 10 && cards[0] < 21) {
            huxi = 12;
          } else if (cards[0] > 0) {
            huxi = 9;
          }
          break;
        case Actions.Pao:
          if (cards[0] > 10 && cards[0] < 21) {
            huxi = 9;
          } else if (cards[0] > 0) {
            huxi = 6;
          }
          break;
        default:
          break;
      }
    }

    // 三张大牌-偎 6 胡
    // 三张小牌-偎 3 胡
    // 三张大牌-碰 3 胡
    // 三张小牌-碰 1 胡
    // 三张大牌-坎 6 胡
    // 三张小牌-坎 3 胡
    if (cards.length === 3) {
      switch (type) {
        case Actions.Wei:
          if (cards[0] > 10 && cards[0] < 21) {
            huxi = 6;
          } else if (cards[0] > 0) {
            huxi = 3;
          }
          break;
        case Actions.Peng:
          if (cards[0] > 10 && cards[0] < 21) {
            huxi = 3;
          } else if (cards[0] > 0) {
            huxi = 1;
          }
          break;
        case Actions.Kan:
          if (cards[0] > 10 && cards[0] < 21) {
            huxi = 6;
          } else if (cards[0] > 0) {
            huxi = 3;
          }
          break;
        default:
          break;
      }
    }
  }

  if (cards.length === 3 && type === Actions.Chi) {
    // 9. 壹贰叁、贰柒拾 6 胡
    if (_.difference(cards, [11, 12, 13]).length === 0 || _.difference(cards, [12, 17, 20]).length === 0) {
      huxi = 6;
    }

    // 10. 一二三、二七十 3 胡
    if ((_.difference(cards, [1, 2, 3]).length === 0) || (_.difference(cards, [2, 7, 10]).length === 0)) {
      huxi = 3;
    }
  }

  return huxi;
};


/**
 * check1 是否是乌胡
 */
HuXiUtil.checkWuHu = function (groupCards, huXi, isLatestCard) {
  // 检查是否是全黑 
  var allCards = []
  groupCards.forEach(group => {
    allCards = allCards.concat(group.cards)
  })
  const countedCards = _.countBy(allCards, function (c) { return c; });

  if (!countedCards[2] &&
    !countedCards[7] &&
    !countedCards[10] &&
    !countedCards[12] &&
    !countedCards[17] &&
    !countedCards[20]) {
    huXi.hts.push(HuTypes.WuHu)
    HuXiUtil.checkKaHu(groupCards, huXi, isLatestCard)
  } else {
    HuXiUtil.checkYiDianHong(groupCards, huXi, isLatestCard)
  }
}

HuXiUtil.checkYiDianHong = function (groupCards, huXi, isLatestCard) {
  var allCards = []
  var hongGroupCount = 0
  groupCards.forEach(group => {
    allCards = allCards.concat(group.cards)
    const diff = _.difference([2, 7, 10, 12, 17, 20], group.cards)
    if (diff.length !== 6) {
      hongGroupCount += 1
    }
  })
  const countedCards = _.countBy(allCards, function (c) { return c; });

  var hongCount = 0
  if (countedCards[2]) {
    hongCount = hongCount + countedCards[2]
  }
  if (countedCards[7]) {
    hongCount = hongCount + countedCards[7]
  }
  if (countedCards[10]) {
    hongCount = hongCount + countedCards[10]
  }
  if (countedCards[12]) {
    hongCount = hongCount + countedCards[12]
  }
  if (countedCards[17]) {
    hongCount = hongCount + countedCards[17]
  }
  if (countedCards[20]) {
    hongCount = hongCount + countedCards[20]
  }

  if (hongCount === 1) {
    // 红数 等一 1 一点红
    huXi.hts.push(HuTypes.YiDianHong)
    HuXiUtil.checkKaHu(groupCards, huXi, isLatestCard)
  } else if (hongGroupCount === 1 && hongCount >= 3) {
    // 一块匾
    huXi.hts.push(HuTypes.YiKuaiBian)
    HuXiUtil.checkKaHu(groupCards, huXi, isLatestCard)
  } else if (hongCount >= 10 && hongCount < 13) {
    huXi.hts.push(HuTypes.Hong10)
    HuXiUtil.checkKaHu(groupCards, huXi, isLatestCard)
  } else if (hongCount >= 13) {
    huXi.hts.push(HuTypes.Hong13)
    HuXiUtil.checkKaHu(groupCards, huXi, isLatestCard)
  }
}

HuXiUtil.checkKaHu = function (groupCards, huXi, isLatestCard) {
  if (huXi.hx === 30) {
    huXi.hts.push(HuTypes.DaKaHu)
  } else if (huXi === 20) {
    huXi.hts.push(HuTypes.XiaoKaHu)
  }

  HuXiUtil.checkHaiDiHu(groupCards, huXi, isLatestCard)
}

HuXiUtil.checkHaiDiHu = function (groupCards, huXi, isLatestCard) {
  if (isLatestCard) {
    huXi.hts.push(HuTypes.HaiDiHu)
  }
}

HuXiUtil.getTotalHuXi = function (huXi) {
  var thx = 0
  var countedTypes = _.countBy(huXi.hts, function (c) { return c })
  console.log(countedTypes)
  var a = (countedTypes[0] || 0) + (countedTypes[1] || 0)
  var b = (countedTypes[4] || 0) + (countedTypes[10] || 0) + (countedTypes[5] || 0)
  var c = (countedTypes[2] || 0) + (countedTypes[3] || 0) + (countedTypes[11] || 0) + (countedTypes[6] || 0) + (countedTypes[7] || 0) + (countedTypes[8] || 0) + (countedTypes[9] || 0)
  console.log(a, b, c)
  if (a >= 1) {
    thx = 100
  } else {
    if (b > 1) {
      thx = 200
    } else if (b == 1) {
      if (c >= 1) {
        thx = 200
      } else {
        thx = 100
      }
    } else {
        thx = Math.pow(2, c) * huXi.hx
    }
  }

  return Math.min(thx, 200)
}


module.exports = HuXiUtil