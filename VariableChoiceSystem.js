//=============================================================================
// RPG Maker MZ - VariableChoiceSystem
//=============================================================================
// Copyright (c) 2025 KiyonakaNata
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php
// ----------------------------------------------------------------------------
// Version
// 1.0.0 2025/08/04 変数選択肢システム（距離条件付き強制終了・選択対応・キャンセル不可）
// ----------------------------------------------------------------------------
// [Blog]   : https://kiyonaka.cfbx.jp/
// [GitHub] : https://github.com/KiyonakaNata/rpgmaker-mz-plugins
//=============================================================================

/*:
 * @target MZ
 * @plugindesc 変数選択肢システム（距離条件付き強制終了対応・キャンセル不可）
 * @author KiyonakaNata
 * 
 * @help VariableChoiceSystem.js
 * 
 * 選択肢を標準イベントコマンドではなく、
 * Scene_Map上で独自に表示・操作できるプラグインです。
 * 
 * 
 * 【できること】
 * - 並列イベントや接触イベントが生きたまま選択肢表示
 * - `$gameSystem.setupVariableChoice(["A", "B", "C"], 10);`
 *     → 変数10に選択index（上記の例だと1,2,3）が格納される
 * - `$gameSystem.setupVariableChoice(["A", "B", "C"], 10, {eventId: 2, distance: 2, index: 99});`
 *     → イベントID 2 がプレイヤーの周囲2マス以内にいる場合、選択肢を強制終了して変数10に99を設定
 * - キャンセル不可（Escキー/右クリックは無効）
 * 
 * 【使用例】
 * ◆スクリプト：$gameSystem.setupVariableChoice(["攻撃", "防御", "逃げる"], 20);
 * ◆スクリプト：$gameSystem.setupVariableChoice(["攻撃", "防御", "逃げる"], 20, {eventId: 2, distance: 2, index: 1});
 *     → イベントID 2 がプレイヤーの周囲2マス以内にいる場合、選択肢を強制終了して変数20に1（攻撃）を設定
 * 
 ** 【注意事項】
 * - ツクールでの文章の表示にてメッセージウィンドウを出すと、ウィンドウを閉じるまで並列処理が止まります
 * - 選択肢表示中に文章を表示させる場合は、$gameMessage.add()を使用してください
 * 
 *  利用規約：
 *  作者に無断で改変、再配布が可能で、利用形態についても制限はありません。
 *  このプラグインはもうあなたのものです。
 */

(() => {

    // 変数選択肢ウィンドウクラス
    class Window_VariableChoice extends Window_Command {
      initialize() {
        // 初期化時は仮のサイズで設定
        super.initialize(new Rectangle(0, 0, 450, 240));
        this.deactivate();
        this.openness = 0;
        // ウィンドウの背景と枠を完全に透明にする
        this.setBackgroundType(0);
        this.opacity = 0;
      }
    
      makeCommandList() {
        const choiceData = $gameSystem._variableChoiceData?.choices || [];
        choiceData.forEach(choice => this.addCommand(choice, 'select'));
      }
      
      // 文字を左寄せにする
      itemTextAlign() {
        return 'left';
      }
      
      adjustWindowSize() {
        const choiceData = $gameSystem._variableChoiceData?.choices || [];
        if (choiceData.length === 0) return;
        
        // 最大文字数を計算
        const maxTextLength = Math.max(...choiceData.map(choice => choice.length));

        // 文字数に応じた横幅計算（1文字あたり約30px）
        const characterWidth = 30;
        const minimumWidth = 200;
        const paddingSize = 20;
        const maxWidth = 450; // 必要に応じて調整
        const calculatedWidth = Math.min(Math.max(minimumWidth, maxTextLength * characterWidth + paddingSize), maxWidth) - 16;
        
        // 高さは選択肢数に応じて調整
        const lineHeight = 48;
        const calculatedHeight = choiceData.length * lineHeight + 20;
        
        // X座標はメッセージウィンドウの右寄せ、Y座標はメッセージウィンドウ上段を下限位置として表示
        const messageWindow = SceneManager._scene._messageWindow;
        const messageWindowX = messageWindow ? messageWindow.x : 0; // メッセージウィンドウのX座標
        const messageWindowWidth = messageWindow ? messageWindow.width : 816; // メッセージウィンドウの幅
        
        // メッセージウィンドウの右端に合わせて右寄せ
        const rightX = messageWindowX + messageWindowWidth - calculatedWidth ; // 枠非表示のため調整
        const windowX = Math.max(0, rightX); // 画面左端を超えないように調整
        
        // メッセージウィンドウの上段を下限位置としてY座標を計算
        const messageWindowY = messageWindow ? messageWindow.y : Graphics.height;
        const windowY = messageWindowY - calculatedHeight ; // 枠非表示のため調整
        
        // ウィンドウサイズと位置を更新
        this.move(windowX, windowY);
        this.width = calculatedWidth;
        this.height = calculatedHeight;
        
        // テキストの表示位置を正しく調整するために再描画
        this.refresh();
      }
    
      update() {
        super.update();
        // 選択肢表示中でも強制選択を処理
        if (this.active && $gameSystem._variableChoiceData?.forcedIndex != null) {
          const selectedIndex = $gameSystem._variableChoiceData.forcedIndex;
          this.select(selectedIndex);
          this.processOk();
          $gameSystem._variableChoiceData.forcedIndex = null;
        }
      }
    
      callOkHandler() {
        const selectedIndex = this.index();
        const targetVariableId = $gameSystem._variableChoiceData?.variableId;
        if (targetVariableId > 0) {
          $gameVariables.setValue(targetVariableId, selectedIndex + 1);
          // 100ms後に0で初期化
          setTimeout(() => {
            $gameVariables.setValue(targetVariableId, 0);
          }, 100);
        }
        this.deactivate();
        this.close();
        if ($gameSystem._variableChoiceData) $gameSystem._variableChoiceData.isActive = false;
      }
    
      // キャンセルを禁止
      processCancel() {
        // 何もしない
      }
    }
    
    const _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
    Scene_Map.prototype.createAllWindows = function() {
      _Scene_Map_createAllWindows.call(this);
      this._variableChoiceWindow = new Window_VariableChoice();
      this.addWindow(this._variableChoiceWindow);
    };
    
    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
      _Scene_Map_update.call(this);
      this.updateVariableChoice();
    };
    
    Scene_Map.prototype.updateVariableChoice = function() {
      const choiceData = $gameSystem._variableChoiceData;
      const choiceWindow = this._variableChoiceWindow;
      // 重複呼び出しを防ぐ：既にアクティブな場合は何もしない
      if (choiceData?.isActive && choiceWindow && choiceWindow.openness === 0 && !choiceWindow.active) {
        // ここで変数を0に初期化
        if (choiceData.variableId > 0) {
          $gameVariables.setValue(choiceData.variableId, 0);
        }
        choiceWindow.refresh();
        // 文字数に応じて横幅を動的調整
        choiceWindow.adjustWindowSize();
        choiceWindow.open();
        choiceWindow.activate();
        choiceWindow.select(-1);
        
        // 強制選択が設定されている場合は即座に処理
        if (choiceData.forcedIndex != null) {
          choiceWindow.select(choiceData.forcedIndex);
          choiceWindow.processOk();
          choiceData.forcedIndex = null;
        }
      }
      
      // 距離条件をチェック
      if (choiceData?.isActive && choiceData.distanceCondition && !choiceData.forcedIndex) {
        this.checkDistanceCondition();
      }
    };
    
    Scene_Map.prototype.checkDistanceCondition = function() {
      const choiceData = $gameSystem._variableChoiceData;
      const distanceCondition = choiceData.distanceCondition;
      
      // 指定されたイベントIDのイベントを取得
      const targetEvent = $gameMap.event(distanceCondition.eventId);
      if (!targetEvent) {
        return;
      }
      
      // プレイヤーとイベントの距離を計算
      const playerPositionX = $gamePlayer.x;
      const playerPositionY = $gamePlayer.y;
      const eventPositionX = targetEvent.x;
      const eventPositionY = targetEvent.y;
      
      const distanceX = Math.abs(playerPositionX - eventPositionX);
      const distanceY = Math.abs(playerPositionY - eventPositionY);
      const calculatedDistance = distanceX + distanceY;
      
      // 指定された距離以内にいるかチェック
      if (calculatedDistance <= distanceCondition.distance) {
        // 変数にindex値を設定
        if (choiceData.variableId > 0) {
          $gameVariables.setValue(choiceData.variableId, distanceCondition.index);
          // 100ms後に0で初期化
          setTimeout(() => {
            $gameVariables.setValue(choiceData.variableId, 0);
          }, 100);
        }
        
        // 選択肢ウィンドウを強制終了
        const choiceWindow = SceneManager._scene._variableChoiceWindow;
        if (choiceWindow && choiceWindow.active) {
          choiceWindow.deactivate();
          choiceWindow.close();
        }
        
        // 選択肢を非アクティブに設定
        choiceData.isActive = false;
        choiceData.distanceCondition = null; // 条件をクリア
      }
    };
    
    Game_System.prototype.setupVariableChoice = function(choices, variableId, distanceCondition = null) {
      // 重複呼び出しを防ぐ：既にアクティブな場合は何もしない
      if (this._variableChoiceData?.isActive) {
        return;
      }
      
      // 変数を初期化
      if (variableId > 0) {
        $gameVariables.setValue(variableId, -1);  // 未選択状態を-1で初期化
      }
      
      this._variableChoiceData = {
        choices,
        variableId,
        isActive: true,
        forcedIndex: null,
        distanceCondition: distanceCondition  // 距離条件を追加
      };
    };
    

    
    })(); 