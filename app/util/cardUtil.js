const _ = require('underscore')
const Actions = require('./Actions')
const logger = require('pomelo-logger').getLogger('pomelo', __filename);
const HuXiUtil = require('./HuXiUtil')
var CardUtil = {};

// 组牌
// example: [75, 13, 5, 28, 35, 54, 22, 19, 62, 51, 3, 42, 59, 79, 73, 24, 57, 10, 58, 44]
// =>
// [
//   Array[2],
//   Array[2],
//   Array[2],
//   Array[2],
//   Array[2],
//   Array[2],
//   Array[3],
//   Array[3],
//   Array[2]
// ]
CardUtil.riffle = function (cards) {
  var countedCards = _.countBy(cards, function (c) { return c; });
  var riffledCards = [];

  // 1. 四张、三张
  _.each(countedCards, function (value, key) {
    if (value === 4) {
      riffledCards.push([key, key, key, key]);
      delete countedCards[key];
    } else if (value === 3) {
      riffledCards.push([key, key, key]);
      delete countedCards[key];
    }
  });


  // 2. 贰柒拾
  if (countedCards[12] && countedCards[17] && countedCards[20]) {
    riffledCards.push([12, 17, 20]);
    countedCards[12]--;
    countedCards[17]--;
    countedCards[20]--;
  }
  if (countedCards[12] && countedCards[17] && countedCards[20]) {
    riffledCards.push([12, 17, 20]);
    countedCards[12]--;
    countedCards[17]--;
    countedCards[20]--;
  }


  // 3. 壹贰叁
  if (countedCards[11] && countedCards[12] && countedCards[13]) {
    riffledCards.push([11, 12, 13]);
    countedCards[11]--;
    countedCards[12]--;
    countedCards[13]--;
  }
  if (countedCards[11] && countedCards[12] && countedCards[13]) {
    riffledCards.push([11, 12, 13]);
    countedCards[11]--;
    countedCards[12]--;
    countedCards[13]--;
  }


  // 4. 二七十
  if (countedCards[2] && countedCards[7] && countedCards[10]) {
    riffledCards.push([2, 7, 10]);
    countedCards[2]--;
    countedCards[7]--;
    countedCards[10]--;
  }
  if (countedCards[2] && countedCards[7] && countedCards[10]) {
    riffledCards.push([2, 7, 10]);
    countedCards[2]--;
    countedCards[7]--;
    countedCards[10]--;
  }


  // 5. 一二三
  if (countedCards[1] && countedCards[2] && countedCards[3]) {
    riffledCards.push([1, 2, 3]);
    countedCards[1]--;
    countedCards[2]--;
    countedCards[3]--;
  }
  if (countedCards[1] && countedCards[2] && countedCards[3]) {
    riffledCards.push([1, 2, 3]);
    countedCards[1]--;
    countedCards[2]--;
    countedCards[3]--;
  }

  // 6. 对子
  _.each(countedCards, function (value, key) {
    if (value == 2) {
      riffledCards.push([key, key]);
      delete countedCards[key];
    }
  });

  // 7. 一句话
  _.each(countedCards, function (value, key) {
    k = parseInt(key, 10);
    if (value && countedCards[k + 1] && countedCards[k + 2] && (k !== 10) && (k !== 9)) {
      riffledCards.push([k, k + 1, k + 2]);
      countedCards[k]--;
      countedCards[k + 1]--;
      countedCards[k + 2]--;

    } else if (!value) {
      delete countedCards[k];
    }
  });



  // 8. 两张
  _.each(countedCards, function (value, key) {
    k = parseInt(key, 10);
    if (value && countedCards[k + 1] && (k !== 10)) {
      riffledCards.push([k, k + 1]);
      countedCards[k]--;
      countedCards[k + 1]--;
    } else if (!value) {
      delete countedCards[k];
    }
  });

  // 9. 散牌
  var countedCardsArray = [];
  _.each(countedCards, function (value, key) {
    if (value) {
      countedCardsArray.push(key);
      if (countedCardsArray.length === 3) {
        riffledCards.push(countedCardsArray);
        countedCardsArray = [];
      }
    } else {
      delete countedCards[key];
    }
  });
  if (countedCardsArray.length > 0) {
    riffledCards.push(countedCardsArray);
  }

  return riffledCards;
}

CardUtil.hasTi = function (cardsOnHand) {
  var countedCards = _.countBy(cardsOnHand, function (c) { return c; })
  var canTiCards = []
  // 1. 四张、三张
  _.each(countedCards, function (value, key) {
    if (value === 4) {
      const card = parseInt(key)
      canTiCards.push([card, card, card, card]);
    }
  })

  if (canTiCards.length > 0) {
    return canTiCards
  } else {
    return null
  }
}

/**
 * 看手里的牌能否 偎
 *
 * @param {*} cardsOnHand
 * @param {*} currentCard
 * @returns
 */
CardUtil.canWei = function (cardsOnHand, currentCard) {
  var countedCards = _.countBy(cardsOnHand, function (c) { return c; })
  var canWeiCards = null
  if (countedCards[currentCard] === 2) {
    canWeiCards = [currentCard, currentCard]
  }
  return canWeiCards
}

/**
 * 看手里的牌能不能 跑 / 提
 * 
 * @param {*} cardsOnHand
 * @param {*} currentCard
 * @returns
 */
CardUtil.canTiHandCards = function (cardsOnHand, currentCard) {
  var countedCards = _.countBy(cardsOnHand, function (c) { return c; })
  var canTiCards = null
  if (countedCards[currentCard] === 3) {
    canTiCards = [currentCard, currentCard, currentCard]
  }
  return canTiCards
}

CardUtil.canPaoHandCards = function (cardsOnHand, currentCard) {
  var countedCards = _.countBy(cardsOnHand, function (c) { return c; })
  var canTiCards = null
  if (countedCards[currentCard] === 3) {
    canTiCards = [currentCard, currentCard, currentCard]
  }
  return canTiCards
}

/**
 * 看组合牌中能不能提
 *
 * @param {*} cardsOnGroup
 * @param {*} currentCard
 * @returns
 */
CardUtil.canTiGroupCards = function (cardsOnGroup, currentCard) {
  var group
  var can = false
  for (var i = 0; i < cardsOnGroup.length; i++) {
    group = cardsOnGroup[i]
    if (group.cards.length == 3 && group.name === Actions.Wei) {
      can = true
      for (var j = 0; j < group.cards.length; j++) {
        if (group.cards[j] != currentCard) {
          can = false
          break
        }
      }
    } else {
      can = false
    }

    if (can) {
      return group
    }
  }

  return null
}

/**
 * 看组合牌中能不能跑 
 *
 * @param {*} cardsOnGroup
 * @param {*} currentCard
 * @returns
 */
CardUtil.canPaoGroupCards = function (cardsOnGroup, currentCard) {
  var group
  var can = false
  for (var i = 0; i < cardsOnGroup.length; i++) {
    group = cardsOnGroup[i]
    if (group.cards.length == 3) {
      can = true
      for (var j = 0; j < group.cards.length; j++) {
        if (group.cards[j] != currentCard) {
          can = false
          break
        }
      }
    } else {
      can = false
    }

    if (can) {
      return group
    }
  }

  return null
}

/**
 * 看组合牌中能不能跑,  
 * 但是碰的牌将不能再跑
 *
 * @param {*} cardsOnGroup
 * @param {*} currentCard
 * @returns
 */
CardUtil.canPaoGroupCardsWithoutPeng = function (cardsOnGroup, currentCard) {
  var group
  var can = false
  for (var i = 0; i < cardsOnGroup.length; i++) {
    group = cardsOnGroup[i]
    if (group.cards.length == 3 && group.name !== Actions.Peng) {
      can = true
      for (var j = 0; j < group.cards.length; j++) {
        if (group.cards[j] != currentCard) {
          can = false
          break
        }
      }
    } else {
      can = false
    }

    if (can) {
      return group
    }
  }

  return null
}

CardUtil.tiPaoCount = function (cardsOnGroup) {
  var group, count = 0
  for (var i = 0; i < cardsOnGroup.length; i++) {
    group = cardsOnGroup[i]
    if (group.name === Actions.Ti || group.name === Actions.Pao) {
      count++
    }
  }

  return count
}

CardUtil.canHu = function (cardsOnHand, cardsOnGroup, currentCard) {
  logger.info('检查能否胡', cardsOnHand, cardsOnGroup, currentCard)
  var allGroups = []
  if (currentCard != 0) {
    var canChiPaoPeng = false

    // 看组合牌中能不能跑起
    var aHandCards = JSON.parse(JSON.stringify(cardsOnHand))
    var aGroupCards = JSON.parse(JSON.stringify(cardsOnGroup))
    var paoGroup = CardUtil.canPaoGroupCards(aGroupCards, currentCard)
    if (paoGroup) {
      canChiPaoPeng = true
      paoGroup.name = Actions.Pao
      paoGroup.cards.push(currentCard)
      var shun = CardUtil.shouShun(aHandCards)
      if (shun) {
        allGroups.push(aGroupCards.concat(shun))
      }
    }

    // 看手里牌能不能跑
    var aHandCards = JSON.parse(JSON.stringify(cardsOnHand))
    var aGroupCards = JSON.parse(JSON.stringify(cardsOnGroup))
    var canPaoCards = CardUtil.canPaoHandCards(aHandCards, currentCard)
    if (canPaoCards) {
      canChiPaoPeng = true
      canPaoCards.forEach(card => {
        CardUtil.deleteCard(aHandCards, card)
      })
      aGroupCards.push({ name: Actions.Pao, cards: [currentCard, currentCard, currentCard, currentCard] })
      var shun = CardUtil.shouShun(aHandCards)
      if (shun) {
        allGroups.push(aGroupCards.concat(shun))
      }
    }

    // 看手里牌能不能碰
    var aHandCards = JSON.parse(JSON.stringify(cardsOnHand))
    var aGroupCards = JSON.parse(JSON.stringify(cardsOnGroup))
    var canPengCards = CardUtil.canPeng(aHandCards, currentCard)
    if (canPengCards) {
      canChiPaoPeng = true
      canPengCards.forEach(card => {
        CardUtil.deleteCard(aHandCards, card)
      })
      aGroupCards.push({ name: Actions.Peng, cards: [currentCard, currentCard, currentCard] })
      var shun = CardUtil.shouShun(aHandCards)
      if (shun) {
        allGroups.push(aGroupCards.concat(shun))
      }
    }

    // 看手里牌能不能吃
    var canChiGroups = CardUtil.canChi(cardsOnHand, currentCard)
    if (canChiGroups) {
      canChiPaoPeng = true
      canChiGroups.forEach(chiGroup => {
        var aHandCards = JSON.parse(JSON.stringify(cardsOnHand))
        var aGroupCards = JSON.parse(JSON.stringify(cardsOnGroup))
        chiGroup.cards.forEach(card => {
          CardUtil.deleteCard(aHandCards, card)
        })
        chiGroup.cards.push(currentCard)
        aGroupCards.push({ name: Actions.Chi, cards: chiGroup.cards })
        var shun = CardUtil.shouShun(aHandCards)
        if (shun) {
          allGroups.push(aGroupCards.concat(shun))
        }
      })
    }

    if (!canChiPaoPeng) {
      var aHandCards = JSON.parse(JSON.stringify(cardsOnHand))
      var aGroupCards = JSON.parse(JSON.stringify(cardsOnGroup))
      aHandCards.push(currentCard)
      var shun = CardUtil.shouShun(aHandCards)
      if (shun) {
        allGroups.push(aGroupCards.concat(shun))
      }
    }
  } else {
    // currentCard === 0
    var aHandCards = JSON.parse(JSON.stringify(cardsOnHand))
    var aGroupCards = JSON.parse(JSON.stringify(cardsOnGroup))
    var shun = CardUtil.shouShun(aHandCards)
    if (shun) {
      allGroups.push(aGroupCards.concat(shun))
    }
  }

  logger.info('能胡的组合', JSON.stringify(allGroups))

  if (allGroups.length >= 1) {
    return allGroups
  } else {
    return false
  }
}

CardUtil.canHu2 = function (cardsOnHand, cardsOnGroup, currentCard) {
  logger.info('检查能否胡', cardsOnHand, cardsOnGroup, currentCard)
  var allGroups = []
  if (currentCard != 0) {
    var canChiPaoPeng = false

    // 看组合牌中能不能跑起
    var aHandCards = JSON.parse(JSON.stringify(cardsOnHand))
    var aGroupCards = JSON.parse(JSON.stringify(cardsOnGroup))
    var paoGroup = CardUtil.canPaoGroupCardsWithoutPeng(aGroupCards, currentCard)
    if (paoGroup) {
      canChiPaoPeng = true
      paoGroup.name = Actions.Pao
      paoGroup.cards.push(currentCard)
      var shun = CardUtil.shouShun(aHandCards)
      if (shun) {
        allGroups.push(aGroupCards.concat(shun))
      }
    }

    // 看手里牌能不能跑
    var aHandCards = JSON.parse(JSON.stringify(cardsOnHand))
    var aGroupCards = JSON.parse(JSON.stringify(cardsOnGroup))
    var canPaoCards = CardUtil.canPaoHandCards(aHandCards, currentCard)
    if (canPaoCards) {
      canChiPaoPeng = true
      canPaoCards.forEach(card => {
        CardUtil.deleteCard(aHandCards, card)
      })
      aGroupCards.push({ name: Actions.Pao, cards: [currentCard, currentCard, currentCard, currentCard] })
      var shun = CardUtil.shouShun(aHandCards)
      if (shun) {
        allGroups.push(aGroupCards.concat(shun))
      }
    }

    // 看手里牌能不能碰
    var aHandCards = JSON.parse(JSON.stringify(cardsOnHand))
    var aGroupCards = JSON.parse(JSON.stringify(cardsOnGroup))
    var canPengCards = CardUtil.canPeng(aHandCards, currentCard)
    if (canPengCards) {
      canChiPaoPeng = true
      canPengCards.forEach(card => {
        CardUtil.deleteCard(aHandCards, card)
      })
      aGroupCards.push({ name: Actions.Peng, cards: [currentCard, currentCard, currentCard] })
      var shun = CardUtil.shouShun(aHandCards)
      if (shun) {
        allGroups.push(aGroupCards.concat(shun))
      }
    }

    // 看手里牌能不能吃
    var canChiGroups = CardUtil.canChi(cardsOnHand, currentCard)
    if (canChiGroups) {
      canChiPaoPeng = true
      canChiGroups.forEach(chiGroup => {
        var aHandCards = JSON.parse(JSON.stringify(cardsOnHand))
        var aGroupCards = JSON.parse(JSON.stringify(cardsOnGroup))
        chiGroup.cards.forEach(card => {
          CardUtil.deleteCard(aHandCards, card)
        })
        chiGroup.cards.push(currentCard)
        aGroupCards.push({ name: Actions.Chi, cards: chiGroup.cards })
        var shun = CardUtil.shouShun(aHandCards)
        if (shun) {
          allGroups.push(aGroupCards.concat(shun))
        }
      })
    }

    if (!canChiPaoPeng) {
      var aHandCards = JSON.parse(JSON.stringify(cardsOnHand))
      var aGroupCards = JSON.parse(JSON.stringify(cardsOnGroup))
      aHandCards.push(currentCard)
      var shun = CardUtil.shouShun(aHandCards)
      if (shun) {
        allGroups.push(aGroupCards.concat(shun))
      }
    }
  } else {
    // currentCard === 0
    var aHandCards = JSON.parse(JSON.stringify(cardsOnHand))
    var aGroupCards = JSON.parse(JSON.stringify(cardsOnGroup))
    var shun = CardUtil.shouShun(aHandCards)
    if (shun) {
      allGroups.push(aGroupCards.concat(shun))
    }
  }

  logger.info('能胡的组合', JSON.stringify(allGroups))

  if (allGroups.length >= 1) {
    return allGroups
  } else {
    return false
  }
}

/**
 * 玩家的牌是否无单牌。
 * @param cards: 手中的牌，或者手中的牌加新翻开的底牌。
 */
CardUtil.shouShun = function (cards) {
  if (cards.length === 0) return []
  // 坎牌不能拆
  var kanShuns = []
  var countedCards = _.countBy(cards, function (c) { return c })
  _.each(countedCards, function (value, key) {
    if (value === 3) {
      var card = parseInt(key)
      kanShuns.push({ name: Actions.Kan, cards: [card, card, card] })
      CardUtil.deleteCard(cards, card)
      CardUtil.deleteCard(cards, card)
      CardUtil.deleteCard(cards, card)
    }
  })

  var allShuns = CardUtil.canShun(cards, [])
  if (allShuns) {
    if (allShuns.length > 0) {
      var maxHuXi = 0
      var maxHuGroup = null
      allShuns.forEach(shuns => {
        var lastedShuns = kanShuns.concat(shuns)
        var huxi = HuXiUtil.getAllGroupHuXi(lastedShuns)
        if (huxi >= maxHuXi) {
          maxHuXi = huxi
          maxHuGroup = lastedShuns
        }
      })
      console.log('手里的牌能够组成顺子...', JSON.stringify(maxHuGroup))
      return maxHuGroup
    } else {
      return kanShuns
    }
  } else {
    return false
  }
}

CardUtil.hasValidaOutCards = function (cards) {
  // 手上没牌了 就不需要出牌了
  if (cards.length === 0) {
    return false
  }

  // 坎牌不能出
  var countedCards = _.countBy(cards, function (c) { return c })
  _.each(countedCards, function (value, key) {
    if (value === 3) {
      delete countedCards[key];
    }
  })

  var keys = _.keys(countedCards)
  if (keys.length > 0) {
    return true
  } else {
    return false
  }
}

CardUtil.hasShun = function (cards) {
  var firstCard = cards.shift()
  var countedCards = _.countBy(cards, function (c) { return c })

}

CardUtil.canPeng = function (cardsOnHand, currentCard) {
  var canPeng = null;
  var countedCards = _.countBy(cardsOnHand, function (c) { return c; });
  if (countedCards[currentCard] === 2) {
    canPeng = [currentCard, currentCard];
  }
  return canPeng;
}

CardUtil.canChi = function (cards, currentCard) {
  logger.info('能否吃牌', cards, currentCard)
  var canChiDatas = []
  var countedCards = _.countBy(cards, function (c) { return c; });
  _.each(countedCards, function (value, key) {
    if (value === 3) {
      delete countedCards[key];
    }
  });

  // 比方 currentCard = 12
  if (countedCards[currentCard - 1]) {
    if (countedCards[currentCard - 2] && currentCard !== 11 && currentCard !== 12) {
      canChiDatas.push({ name: Actions.Chi, cards: [currentCard - 1, currentCard - 2] }) // 判断8在尾部 查询 6 7 '8'  尾牌不能等于 11 12
    }
    if (countedCards[currentCard + 1] && currentCard !== 10 && currentCard !== 11) {
      canChiDatas.push({ name: Actions.Chi, cards: [currentCard - 1, currentCard + 1] }) // 判断8在中部 查询 7 '8' 9  中牌不能等于 10 11
    }
  }

  if (countedCards[currentCard + 1]) {
    if (countedCards[currentCard + 2] && currentCard !== 9 && currentCard !== 10) {
      canChiDatas.push({ name: Actions.Chi, cards: [currentCard + 1, currentCard + 2] }) // 判断8在首部 查询 '8' 9 10 首牌不能等于 9 10
    }
  }

  var diff
  if (currentCard < 11) {
    // 8
    if (countedCards[currentCard] && countedCards[currentCard + 10]) {
      canChiDatas.push({ name: Actions.Chi, cards: [currentCard, currentCard + 10] }) // 判断 8 8 18
    }
    if (countedCards[currentCard + 10] >= 2) {
      canChiDatas.push({ name: Actions.Chi, cards: [currentCard + 10, currentCard + 10] }) // 判断 8 18 18
    }

    // 2 7 10
    diff = _.difference([2, 7, 10], [currentCard])
    if (diff.length !== 3 && countedCards[diff[0]] && countedCards[diff[1]]) {
      canChiDatas.push({ name: Actions.Chi, cards: diff })
    }
  } else {
    // 18
    if (countedCards[currentCard] && countedCards[currentCard - 10]) {
      canChiDatas.push({ name: Actions.Chi, cards: [currentCard, currentCard - 10] }) // 判断 18 18 8
    }
    if (countedCards[currentCard - 10] >= 2) {
      canChiDatas.push({ name: Actions.Chi, cards: [currentCard - 10, currentCard - 10] }) // 判断 18 8 8
    }

    // 12 17 20
    diff = _.difference([12, 17, 20], [currentCard])
    if (diff.length !== 3 && countedCards[diff[0]] && countedCards[diff[1]]) {
      canChiDatas.push({ name: Actions.Chi, cards: diff })
    }
  }

  var validChiDatas = [] // 有效的吃数据
  canChiDatas.forEach(chiData => {
    var subBi = CardUtil.canBi(_.clone(cards), chiData.cards, currentCard)
    if (subBi) {
      if (subBi.length > 0) {
        chiData.bi = subBi
        validChiDatas.push(chiData) // 有效吃
      }
    } else {
      validChiDatas.push(chiData) // 有效吃
    }
  })

  logger.info('吃的结果', JSON.stringify(validChiDatas))

  if (validChiDatas.length > 0) {
    return validChiDatas
  } else {
    return null
  }
}

CardUtil.canBi = function (cards, needDeleteCards, currentCard) {
  // 删除要删除的卡牌
  needDeleteCards.forEach(card => {
    CardUtil.deleteCard(cards, card)
  })

  var countedCards = _.countBy(cards, function (c) { return c; });
  _.each(countedCards, function (value, key) {
    if (value === 3) {
      delete countedCards[key];
    }
  })

  // 如果没有2 返回null
  if (!countedCards[currentCard]) {
    return null
  }

  var biDatas = []

  // 比方 currentCard = 8
  if (countedCards[currentCard - 1]) {
    if (countedCards[currentCard - 2] && currentCard !== 11 && currentCard !== 12) {
      biDatas.push({ name: Actions.Chi, cards: [currentCard - 2, currentCard - 1, currentCard] }) // 判断8在尾部 查询 6 7 '8'  尾牌不能等于 11 12
    }
    if (countedCards[currentCard + 1] && currentCard !== 10 && currentCard !== 11) {
      biDatas.push({ name: Actions.Chi, cards: [currentCard - 1, currentCard + 1, currentCard] }) // 判断8在中部 查询 7 '8' 9  中牌不能等于 10 11
    }
  }

  if (countedCards[currentCard + 1]) {
    if (countedCards[currentCard + 2] && currentCard !== 9 && currentCard !== 10) {
      biDatas.push({ name: Actions.Chi, cards: [currentCard + 1, currentCard + 2, currentCard] }) // 判断8在首部 查询 '8' 9 10 首牌不能等于 9 10
    }
  }

  var diff
  if (currentCard < 11) {
    // 8
    if (countedCards[currentCard] >= 2 && countedCards[currentCard + 10]) {
      biDatas.push({ name: Actions.Chi, cards: [currentCard + 10, currentCard, currentCard] }) // 判断 8 8 18
    }
    if (countedCards[currentCard + 10] >= 2) {
      biDatas.push({ name: Actions.Chi, cards: [currentCard + 10, currentCard + 10, currentCard] }) // 判断 8 18 18
    }

    // 2 7 10
    diff = _.difference([2, 7, 10], [currentCard])
    if (diff.length !== 3 && countedCards[diff[0]] && countedCards[diff[1]]) {
      diff.push(currentCard)
      biDatas.push({ name: Actions.Chi, cards: diff })
    }
  } else {
    // 18
    if (countedCards[currentCard] >= 2 && countedCards[currentCard - 10]) {
      biDatas.push({ name: Actions.Chi, cards: [currentCard - 10, currentCard, currentCard] }) // 判断 18 18 8
    }
    if (countedCards[currentCard - 10] >= 2) {
      biDatas.push({ name: Actions.Chi, cards: [currentCard - 10, currentCard - 10, currentCard] }) // 判断 18 8 8
    }

    // 12 17 20
    diff = _.difference([12, 17, 20], [currentCard])
    if (diff.length !== 3 && countedCards[diff[0]] && countedCards[diff[1]]) {
      diff.push(currentCard)
      biDatas.push({ name: Actions.Chi, cards: diff })
    }
  }

  var validBiDatas = []
  biDatas.forEach(biData => {
    var subBi = CardUtil.canBi(_.clone(cards), biData.cards, currentCard)
    if (subBi) {
      if (subBi.length > 0) {
        biData.bi = subBi
        validBiDatas.push(biData) // 返回的长度大于0 为有效比
      }
    } else {
      validBiDatas.push(biData) // 返回false 为有效比 没有子比了
    }
  })

  return validBiDatas
}

CardUtil.hasCard = function (cards, card) {
  logger.info('看牌是否已经存在', cards, card)
  var countedCards = _.countBy(cards, function (c) { return c; });
  if (countedCards[card]) {
    return true
  } else {
    return false
  }
}

CardUtil.has3Ti5Kan = function (cards) {
  logger.info('看牌是否存在3提5坎', cards)
  var countedCards = _.countBy(cards, function (c) { return c; })
  var tiCount = 0
  var kanCount = 0
  _.each(countedCards, function (value, key) {
    if (value === 3) {
      kanCount++
    } else if (value === 4) {
      tiCount++
    }
  })
  logger.info('提数', tiCount, '坎数', kanCount)
  if (tiCount >= 3 || kanCount >= 5) {
    return true
  } else {
    return false
  }
}

//---------------------------------------------------------------------------------------------------------------
// 生成牌
//---------------------------------------------------------------------------------------------------------------
CardUtil.generatePoker = function () {
  var cardValue = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
  var allCards = []
  let card
  for (var j = 0; j < cardValue.length; j++) {
    card = cardValue[j]
    allCards.push(card)
    allCards.push(card)
    allCards.push(card)
    allCards.push(card)
  }
  return allCards
}

//---------------------------------------------------------------------------------------------------------------
// 洗牌
//---------------------------------------------------------------------------------------------------------------
CardUtil.shufflePoker = function (arr) {
  if (!arr) {
    throw '错误，请传入正确数组';
  }
  var newArr = arr.slice(0);
  for (var i = newArr.length - 1; i >= 0; i--) {
    var randomIndex = Math.floor(Math.random() * (i + 1))
    var itemAtIndex = newArr[randomIndex]
    newArr[randomIndex] = newArr[i]
    newArr[i] = itemAtIndex
  }

  return newArr
}


CardUtil.deleteCard = function (cards, card) {
  for (var i = 0; i < cards.length; i++) {
    if (cards[i] == card) {
      cards.splice(i, 1)
      break
    }
  }
}

CardUtil.canShun = function (cards, needDeleteCards) {
  // logger.info('能否顺牌', cards, needDeleteCards)
  needDeleteCards.forEach(card => {
    CardUtil.deleteCard(cards, card)
  })

  var allShuns = []
  var canShuns = []

  if (cards.length > 0) {
    var countedCards = _.countBy(cards, function (c) { return c; });
    var currentCard = cards[0]
    countedCards[currentCard]--

    // 列出吃
    if (countedCards[currentCard - 1]) {
      if (countedCards[currentCard - 2] && currentCard !== 11 && currentCard !== 12) {
        canShuns.push({ name: Actions.Chi, cards: [currentCard - 2, currentCard - 1, currentCard] }) // 判断8在尾部 查询 6 7 '8'  尾牌不能等于 11 12
      }
      if (countedCards[currentCard + 1] && currentCard !== 10 && currentCard !== 11) {
        canShuns.push({ name: Actions.Chi, cards: [currentCard - 1, currentCard, currentCard + 1] }) // 判断8在中部 查询 7 '8' 9  中牌不能等于 10 11
      }
    }
    if (countedCards[currentCard + 1]) {
      if (countedCards[currentCard + 2] && currentCard !== 9 && currentCard !== 10) {
        canShuns.push({ name: Actions.Chi, cards: [currentCard, currentCard + 1, currentCard + 2] }) // 判断8在首部 查询 '8' 9 10 首牌不能等于 9 10
      }
    }
    var diff
    if (currentCard < 11) {
      // 8
      if (countedCards[currentCard] && countedCards[currentCard + 10]) {
        canShuns.push({ name: Actions.Chi, cards: [currentCard, currentCard, currentCard + 10] }) // 判断 8 8 18
      }
      if (countedCards[currentCard + 10] >= 2) {
        canShuns.push({ name: Actions.Chi, cards: [currentCard, currentCard + 10, currentCard + 10] }) // 判断 8 18 18
      }
      // 2 7 10
      diff = _.difference([2, 7, 10], [currentCard])
      if (diff.length !== 3 && countedCards[diff[0]] && countedCards[diff[1]]) {
        canShuns.push({ name: Actions.Chi, cards: [2, 7, 10] })
      }
    } else {
      // 18
      if (countedCards[currentCard] && countedCards[currentCard - 10]) {
        canShuns.push({ name: Actions.Chi, cards: [currentCard, currentCard, currentCard - 10] }) // 判断 18 18 8
      }
      if (countedCards[currentCard - 10] >= 2) {
        canShuns.push({ name: Actions.Chi, cards: [currentCard, currentCard - 10, currentCard - 10] }) // 判断 18 8 8
      }
      // 12 17 20
      diff = _.difference([12, 17, 20], [currentCard])
      if (diff.length !== 3 && countedCards[diff[0]] && countedCards[diff[1]]) {
        canShuns.push({ name: Actions.Chi, cards: [12, 17, 20] })
      }
    }

    // 12 12
    // 列出 将
    if (countedCards[currentCard] >= 1) {
      canShuns.push({ name: Actions.Jiang, cards: [currentCard, currentCard] })
    }
    if (canShuns.length > 0) {
      canShuns.forEach(shun => {
        var subShuns = CardUtil.canShun(_.clone(cards), shun.cards)
        if (subShuns) {
          if (subShuns.length > 0) {
            subShuns.forEach(subShun => {
              allShuns.push([shun].concat(subShun))
            })
          } else {
            allShuns.push([shun])
          }
        }
      })

      var validAllShuns = []
      allShuns.forEach(shuns => {
        var jc = 0
        shuns.forEach(shun => {
          if (shun.name === Actions.Jiang)
            jc++
        })

        if (jc <= 1) {
          validAllShuns.push(shuns)
        }
      })

      if (validAllShuns.length > 0) {
        return validAllShuns
      } else {
        return false
      }
    } else {
      return false
    }
  } else {
    return []
  }
}

module.exports = CardUtil