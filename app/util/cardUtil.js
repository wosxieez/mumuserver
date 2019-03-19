const _ = require('underscore')

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
};

/**
 * 返回胡息数, 最小单位是四张，三张，一句话(二七十，一二三; 壹贰叁、贰柒拾)
 * @param cards 
 * @param type: CardUtil.Actions 中的一种，包括: 提，跑，偎，碰，吃
 * @return huxi
 */
// 1. 四张大牌--提 12 胡息
// 2. 四张小牌--提 9 胡
// 3. 四张大牌--跑 9 胡息
// 4. 四张小牌--跑 6 胡

// 5. 三张大牌--偎 6 胡
// 6. 三张小牌--偎 3 胡
// 7. 三张大牌-碰 3 胡
// 8. 三张小牌-碰 1 胡

// 9. 壹贰叁、贰柒拾--吃 6 胡
// 10. 一二三、二七十--吃 3 胡
CardUtil.getHuXi = function (cards, type) {
  var huxi = 0;
  if ((_.union(cards, [])).length === 1) {
    // 1. 四张大牌--提 12 胡息
    // 2. 四张小牌--提 9 胡
    // 3. 四张大牌--跑 9 胡息
    // 4. 四张小牌--跑 6 胡
    if (cards.length === 4) {
      switch (type) {
        case CardUtil.Actions.Ti:
          if (cards[0] > 10 && cards[0] < 21) {
            huxi = 12;
          } else if (cards[0] > 0) {
            huxi = 9;
          }
          break;
        case CardUtil.Actions.Pao:
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

    // 5. 三张大牌--偎 6 胡
    // 6. 三张小牌--偎 3 胡
    // 7. 三张大牌-碰 3 胡
    // 8. 三张小牌-碰 1 胡
    if (cards.length === 3) {
      switch (type) {
        case CardUtil.Actions.Wei:
          if (cards[0] > 10 && cards[0] < 21) {
            huxi = 6;
          } else if (cards[0] > 0) {
            huxi = 3;
          }
          break;
        case CardUtil.Actions.Peng:
          if (cards[0] > 10 && cards[0] < 21) {
            huxi = 3;
          } else if (cards[0] > 0) {
            huxi = 1;
          }
          break;
        default:
          break;
      }
    }
  }


  if (cards.length === 3 && type === CardUtil.Actions.Chi) {
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
CardUtil.canTi = function (cardsOnHand, currentCard) {
  var countedCards = _.countBy(cardsOnHand, function (c) { return c; })
  var canTiCards = null
  if (countedCards[currentCard] === 3) {
    canTiCards = [currentCard, currentCard, currentCard]
  }
  return canTiCards
}

/**
 * 看组合牌中能不能 跑 / 提
 *
 * @param {*} cardsOnGroup
 * @param {*} currentCard
 * @returns
 */
CardUtil.canTi2 = function (cardsOnGroup, currentCard) {

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

CardUtil.tiPaoCount = function (cardsOnGroup) {
  var group, count = 0
  for (var i = 0; i < cardsOnGroup.length; i++) {
    group = cardsOnGroup[i]
    if (group.name === 'ti' || group.name === 'pao') {
      count++
    }
  }

  return count
}

CardUtil.canHu = function (cardsOnHand, cardsOnTable, currentCard) {
  var huxi = 0;
  var copyedCards = _.clone(cardsOnHand);
  if (currentCard !== 0) {
    copyedCards.push(currentCard);
  }
  var onHand = CardUtil.shouShun(copyedCards);
  if (onHand && onHand.length) {
    const fullGroupCards = cardsOnTable.concat(onHand)
    _.each(fullGroupCards, function (group) {
      if (group.name === CardUtil.Actions.Peng) {
        huxi += CardUtil.getHuXi(group.cards, CardUtil.Actions.Peng)
      } else if (group.name === CardUtil.Actions.Wei) {
        huxi += CardUtil.getHuXi(group.cards, CardUtil.Actions.Wei)
      } else if (group.name === CardUtil.Actions.Ti) {
        huxi += CardUtil.getHuXi(group.cards, CardUtil.Actions.Ti)
      } else if (group.name === CardUtil.Actions.Pao) {
        huxi += CardUtil.getHuXi(group.cards, CardUtil.Actions.Pao)
      } else if (group.name === CardUtil.Actions.Chi) {
        huxi += CardUtil.getHuXi(group.cards, CardUtil.Actions.Chi)
      }
    })

    const canHu = (huxi >= 15);
    console.log('能否胡', canHu, huxi)
    if (canHu) {
      return [huxi, fullGroupCards]
    } else {
      return false
    }
  } else {
    return false
  }
}

/**
 * 玩家的牌是否无单牌。
 * @param cards: 手中的牌，或者手中的牌加新翻开的底牌。
 */
CardUtil.shouShun = function (cards) {
  var countedCards = _.countBy(cards, function (c) { return c; });
  var results = [];

  // 1. 处理三张，并找出所有单张
  _.each(countedCards, function (value, key) {
    const card = parseInt(key)
    // 三张的剔出来
    if (value === 3) {
      results.push({ name: 'peng', cards: [card, card, card] });
      delete countedCards[key];
    }
  })

  var findShunzi = function (singleCard) {
    // 贰柒拾
    var diff = _.difference([12, 17, 20], singleCard);
    if (diff.length !== 3 && countedCards[diff[0]] && countedCards[diff[1]]) {
      countedCards[singleCard]--;
      countedCards[diff[1]]--;
      countedCards[diff[0]]--;
      return [singleCard, diff[0], diff[1]];
    }

    // 二七十
    diff = _.difference([2, 7, 10], singleCard);
    if (diff.length !== 3 && countedCards[diff[0]] && countedCards[diff[1]]) {
      countedCards[singleCard]--;
      countedCards[diff[1]]--;
      countedCards[diff[0]]--;
      return [singleCard, diff[0], diff[1]];
    }

    // 顺子
    if (countedCards[singleCard + 1] && countedCards[singleCard + 2]) {
      countedCards[singleCard]--;
      countedCards[singleCard + 1]--;
      countedCards[singleCard + 2]--;
      return [singleCard, singleCard + 1, singleCard + 2];
    }
    if (countedCards[singleCard + 1] && countedCards[singleCard - 1]) {
      countedCards[singleCard]--;
      countedCards[singleCard + 1]--;
      countedCards[singleCard - 1]--;
      return [singleCard - 1, singleCard, singleCard + 1];
    }

    if (countedCards[singleCard - 1] && countedCards[singleCard - 2]) {
      countedCards[singleCard]--;
      countedCards[singleCard - 1]--;
      countedCards[singleCard - 2]--;
      return [singleCard - 2, singleCard - 1, singleCard];
    }

    // 大小混搭
    if (singleCard > 10 && (countedCards[singleCard - 10] > 1)) {
      countedCards[singleCard]--;
      countedCards[singleCard - 10] -= 2;
      return [singleCard, singleCard - 10, singleCard - 10];
    }
    if (singleCard < 11 && (countedCards[singleCard + 10] > 1)) {
      countedCards[singleCard]--;
      countedCards[singleCard + 10] -= 2;
      return [singleCard, singleCard + 10, singleCard + 10];
    }
    return false;
  };

  // 处理单张
  _.each(countedCards, function (value, key) {
    if (value === 1) {
      const card = parseInt(key)
      const shunzi = findShunzi(card)
      if (!!shunzi) {
        results.push({ name: 'chi', cards: shunzi })
      }
    }
  })

  // 去掉所有组合掉的牌
  _.each(countedCards, function (value, key) {
    if (value === 0) {
      delete countedCards[key];
    }
  })

  var keys = _.keys(countedCards)
  if (keys.length > 1) {
    return false
  } else if (keys.length == 1) {
    if (countedCards[keys[0]] === 2) {
      results.push({ name: 'dui', cards: [parseInt(keys[0]), parseInt(keys[0])] })
    } else {
      return false
    }
  }

  return results
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
  console.log('能否吃牌', cards, currentCard)
  var canChiDatas = []
  var countedCards = _.countBy(cards, function (c) { return c; });
  _.each(countedCards, function (value, key) {
    if (value === 3) {
      delete countedCards[key];
    }
  });

  // 比方 currentCard = 8
  if (countedCards[currentCard - 1]) {
    if (countedCards[currentCard - 2] && currentCard !== 11 && currentCard !== 12) {
      canChiDatas.push({ name: 'chi', cards: [currentCard - 1, currentCard - 2] }) // 判断8在尾部 查询 6 7 '8'  尾牌不能等于 11 12
    }
    if (countedCards[currentCard + 1] && currentCard !== 10 && currentCard !== 11) {
      canChiDatas.push({ name: 'chi', cards: [currentCard - 1, currentCard + 1] }) // 判断8在中部 查询 7 '8' 9  中牌不能等于 10 11
    }
  }

  if (countedCards[currentCard + 1]) {
    if (countedCards[currentCard + 2] && currentCard !== 9 && currentCard !== 10) {
      canChiDatas.push({ name: 'chi', cards: [currentCard + 1, currentCard + 2] }) // 判断8在首部 查询 '8' 9 10 首牌不能等于 9 10
    }
  }

  var diff
  if (currentCard < 11) {
    // 8
    if (countedCards[currentCard] && countedCards[currentCard + 10]) {
      canChiDatas.push({ name: 'chi', cards: [currentCard, currentCard + 10] }) // 判断 8 8 18
    }
    if (countedCards[currentCard + 10] >= 2) {
      canChiDatas.push({ name: 'chi', cards: [currentCard + 10, currentCard + 10] }) // 判断 8 18 18
    }

    // 2 7 10
    diff = _.difference([2, 7, 10], [currentCard])
    if (diff.length !== 3 && countedCards[diff[0]] && countedCards[diff[1]]) {
      canChiDatas.push({ name: 'chi', cards: diff })
    }
  } else {
    // 18
    if (countedCards[currentCard] && countedCards[currentCard - 10]) {
      canChiDatas.push({ name: 'chi', cards: [currentCard, currentCard - 10] }) // 判断 18 18 8
    }
    if (countedCards[currentCard - 10] >= 2) {
      canChiDatas.push({ name: 'chi', cards: [currentCard - 10, currentCard - 10] }) // 判断 18 8 8
    }

    // 12 17 20
    diff = _.difference([12, 17, 20], [currentCard])
    if (diff.length !== 3 && countedCards[diff[0]] && countedCards[diff[1]]) {
      canChiDatas.push({ name: 'chi', cards: diff })
    }
  }

  canChiDatas.forEach(chiData => {
    chiData.bi = CardUtil.canBi(_.clone(cards), chiData.cards, currentCard)
  })

  console.log('吃的结果', JSON.stringify(canChiDatas))

  if (canChiDatas.length > 0) {
    return canChiDatas
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
      biDatas.push({name: 'bi', cards: [currentCard, currentCard - 1, currentCard - 2]}) // 判断8在尾部 查询 6 7 '8'  尾牌不能等于 11 12
    }
    if (countedCards[currentCard + 1] && currentCard !== 10 && currentCard !== 11) {
      biDatas.push({name: 'bi', cards: [currentCard - 1, currentCard, currentCard + 1]}) // 判断8在中部 查询 7 '8' 9  中牌不能等于 10 11
    }
  }

  if (countedCards[currentCard + 1]) {
    if (countedCards[currentCard + 2] && currentCard !== 9 && currentCard !== 10) {
      biDatas.push({name: 'bi', cards: [currentCard, currentCard + 1, currentCard + 2]}) // 判断8在首部 查询 '8' 9 10 首牌不能等于 9 10
    }
  }

  var diff
  if (currentCard < 11) {
    // 8
    if (countedCards[currentCard] >= 2 && countedCards[currentCard + 10]) {
      biDatas.push({name: 'bi', cards: [currentCard, currentCard, currentCard + 10]}) // 判断 8 8 18
    }
    if (countedCards[currentCard + 10] >= 2) {
      biDatas.push({name: 'bi', cards: [currentCard, currentCard + 10, currentCard + 10]}) // 判断 8 18 18
    }

    // 2 7 10
    diff = _.difference([2, 7, 10], [currentCard])
    if (diff.length !== 3 && countedCards[diff[0]] && countedCards[diff[1]]) {
      diff.push(currentCard)
      biDatas.push({name: 'bi', cards: diff})
    }
  } else {
    // 18
    if (countedCards[currentCard] >= 2 && countedCards[currentCard - 10]) {
      biDatas.push({name: 'bi', cards: [currentCard, currentCard, currentCard - 10]}) // 判断 18 18 8
    }
    if (countedCards[currentCard - 10] >= 2) {
      biDatas.push({name: 'bi', cards: [currentCard, currentCard - 10, currentCard - 10]}) // 判断 18 8 8
    }

    // 12 17 20
    diff = _.difference([12, 17, 20], [currentCard])
    if (diff.length !== 3 && countedCards[diff[0]] && countedCards[diff[1]]) {
      diff.push(currentCard)
      biDatas.push({name: 'bi', cards: diff})
    }
  }
  
  biDatas.forEach(biData => {
    biData.bi = CardUtil.canBi(_.clone(cards), biData.cards, currentCard)
  })

  return biDatas
}

CardUtil.hasCard = function (cards, card) {
  console.log('看牌是否已经存在', cards, card)
  var countedCards = _.countBy(cards, function (c) { return c; });
  if (countedCards[card]) {
    return true
  } else {
    return false
  }
}

CardUtil.has3Ti5Kan = function (cards) {
  return false
}

CardUtil.Actions = {
  NewCard: 'newCard',         // 出牌
  Ti: "ti",         // 提
  Pao: "pao",       // 跑
  Wei: "wei",       // 偎
  Peng: "peng",     // 碰
  Hu: "hu",         // 胡牌
  Chi: "chi",       // 吃牌
  Cancel: "cancel", // 取消 
  Idle: "idle"      // 无操作
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


module.exports = CardUtil