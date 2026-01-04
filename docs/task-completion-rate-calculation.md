# タスク達成率の計算方法

## 概要

タスク達成率は、予定タスクと実績タスクを比較して、どれだけ計画を達成できたかを数値化したものです。

## 計算方法の種類

### 1. タスク数ベースの達成率

**計算式：**
```
達成率 = (完了タスク数 / 予定タスク数) × 100
```

**例：**
- 予定タスク：5個
- 完了タスク：3個
- 達成率：60%

**特徴：**
- シンプルで分かりやすい
- タスクの重要度や工数が考慮されない
- 小さなタスクと大きなタスクが同じ重み

### 2. 時間ベースの達成率

**計算式：**
```
達成率 = (実績時間合計 / 予定時間合計) × 100
```

**例：**
- 予定時間合計：8時間
- 実績時間合計：6時間
- 達成率：75%

**特徴：**
- 工数を考慮した評価が可能
- 予定時間が0の場合は計算不可
- 100%を超えることもある（予定より多く作業した場合）

### 3. タスクマッチングベースの達成率

**計算式：**
```
達成率 = (マッチしたタスクの予定時間合計 / 全予定時間合計) × 100
```

**マッチング方法：**
- タスク名の完全一致
- タスク名の部分一致（類似度計算）
- 手動マッチング

**例：**
- 予定タスク：
  - 「API開発」（4時間）
  - 「テスト作成」（2時間）
  - 「ドキュメント作成」（2時間）
- 実績タスク：
  - 「API開発」（5時間）← マッチ
  - 「テスト作成」（1.5時間）← マッチ
  - 「バグ修正」（1時間）← マッチしない
- マッチした予定時間：4 + 2 = 6時間
- 全予定時間：8時間
- 達成率：75%

**特徴：**
- 予定と実績の対応関係を考慮
- 予定外のタスクは達成率に含めない
- マッチングの精度が重要

### 4. 進捗率（個別タスク）

**計算式：**
```
進捗率 = (実時間 / 予定時間) × 100
```

**例：**
- 予定時間：4時間
- 実時間：5時間
- 進捗率：125%（予定より多く作業）

**特徴：**
- 各タスクの進捗を個別に評価
- 100%を超えることもある
- タスクごとの効率性を把握可能

## 推奨される計算方法

### 基本：時間ベースの達成率

最もシンプルで実用的な方法です。

```typescript
function calculateTaskCompletionRate(
  plannedTasks: Task[],
  actualTasks: Task[]
): number {
  const plannedTotal = plannedTasks.reduce(
    (sum, task) => sum + parseFloat(task.hours || "0"),
    0
  );
  
  const actualTotal = actualTasks.reduce(
    (sum, task) => sum + parseFloat(task.hours || "0"),
    0
  );
  
  if (plannedTotal === 0) return 0;
  
  return (actualTotal / plannedTotal) * 100;
}
```

### 発展：マッチングベースの達成率

より正確な評価が可能ですが、マッチングロジックが必要です。

```typescript
function calculateMatchedCompletionRate(
  plannedTasks: Task[],
  actualTasks: Task[]
): number {
  const plannedTotal = plannedTasks.reduce(
    (sum, task) => sum + parseFloat(task.hours || "0"),
    0
  );
  
  if (plannedTotal === 0) return 0;
  
  // タスク名でマッチング（簡易版：完全一致）
  const matchedPlannedHours = plannedTasks.reduce((sum, planned) => {
    const matched = actualTasks.find(
      actual => actual.task.trim() === planned.task.trim()
    );
    if (matched) {
      return sum + parseFloat(planned.hours || "0");
    }
    return sum;
  }, 0);
  
  return (matchedPlannedHours / plannedTotal) * 100;
}
```

## 注意点

1. **予定時間が0の場合**
   - 時間ベースの計算では0除算エラーを避ける必要がある
   - タスク数ベースの計算にフォールバック

2. **予定外タスクの扱い**
   - 時間ベース：実績時間に含める（達成率が100%超になる可能性）
   - マッチングベース：除外する（達成率は100%以下）

3. **タスク名の不一致**
   - 「API開発」と「API実装」は別タスクとして扱われる
   - 類似度計算や手動マッチングが必要な場合がある

4. **複数日の集計**
   - 週間・月間の達成率は、各日の達成率の平均または合計時間で計算

## UI表示例

```
タスク達成率: 75%
├─ 予定時間: 8.0時間
├─ 実績時間: 6.0時間
└─ 差分: -2.0時間
```

```
タスク達成率: 60% (3/5タスク完了)
├─ 完了: 3タスク
├─ 未完了: 2タスク
└─ 予定外: 1タスク
```




