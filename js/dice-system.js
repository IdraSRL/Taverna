// Dice system management
import FirebaseHelper from './firebase.js';

export class DiceSystem {
    constructor(authManager) {
        this.authManager = authManager;
        this.diceGroups = [];
        this.groupCounter = 0;
        this.resultsListener = null;
        this.diceColors = [
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
            '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43'
        ];
    }
    
    // Initialize dice system
    init() {
        console.log('🎲 Inizializzazione sistema dadi...');
        this.setupEventListeners();
        this.addInitialDiceGroup();
        this.listenToResults();
    }
    
    // Setup event listeners
    setupEventListeners() {
        const addGroupBtn = document.getElementById('addDiceGroup');
        const rollBtn = document.getElementById('rollAllDice');
        
        if (addGroupBtn) addGroupBtn.addEventListener('click', () => this.addDiceGroup());
        if (rollBtn) rollBtn.addEventListener('click', () => this.rollAllDice());
        
        console.log('✅ Event listeners dadi configurati');
    }
    
    // Add initial dice group
    addInitialDiceGroup() {
        this.addDiceGroup();
    }
    
    // Add new dice group
    addDiceGroup() {
        const groupId = `group_${this.groupCounter++}`;
        const group = {
            id: groupId,
            count: 1,
            type: 'd20',
            color: this.diceColors[this.diceGroups.length % this.diceColors.length],
            modifier: 0
        };
        
        this.diceGroups.push(group);
        this.renderDiceGroups();
        this.updateRollButton();
        
        console.log('🎲 Aggiunto gruppo dadi:', groupId);
    }
    
    // Remove dice group
    removeDiceGroup(groupId) {
        this.diceGroups = this.diceGroups.filter(group => group.id !== groupId);
        this.renderDiceGroups();
        this.updateRollButton();
        
        console.log('🗑️ Rimosso gruppo dadi:', groupId);
    }
    
    // Render dice groups
    renderDiceGroups() {
        const container = document.getElementById('diceGroups');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.diceGroups.forEach((group, index) => {
            const groupElement = this.createDiceGroupElement(group, index);
            container.appendChild(groupElement);
        });
    }
    
    // Create dice group element
    createDiceGroupElement(group, index) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'dice-group';
        groupDiv.innerHTML = `
            <div class="dice-group-header">
                <span class="group-title">Gruppo ${index + 1}</span>
                <button class="remove-group" onclick="window.diceSystem.removeDiceGroup('${group.id}')">✕</button>
            </div>
            <div class="dice-row">
                <input type="number" class="dice-count" min="1" max="20" value="${group.count}" 
                       onchange="window.diceSystem.updateGroup('${group.id}', 'count', this.value)">
                <select class="dice-type" onchange="window.diceSystem.updateGroup('${group.id}', 'type', this.value)">
                    <option value="d4" ${group.type === 'd4' ? 'selected' : ''}>d4</option>
                    <option value="d6" ${group.type === 'd6' ? 'selected' : ''}>d6</option>
                    <option value="d8" ${group.type === 'd8' ? 'selected' : ''}>d8</option>
                    <option value="d10" ${group.type === 'd10' ? 'selected' : ''}>d10</option>
                    <option value="d12" ${group.type === 'd12' ? 'selected' : ''}>d12</option>
                    <option value="d20" ${group.type === 'd20' ? 'selected' : ''}>d20</option>
                    <option value="d100" ${group.type === 'd100' ? 'selected' : ''}>d100</option>
                </select>
                <input type="color" class="dice-color" value="${group.color}" 
                       onchange="window.diceSystem.updateGroup('${group.id}', 'color', this.value)">
                <input type="number" class="modifier-input" placeholder="+/-" value="${group.modifier || ''}"
                       onchange="window.diceSystem.updateGroup('${group.id}', 'modifier', this.value)">
            </div>
        `;
        
        return groupDiv;
    }
    
    // Update dice group
    updateGroup(groupId, property, value) {
        const group = this.diceGroups.find(g => g.id === groupId);
        if (group) {
            if (property === 'count') {
                group.count = Math.max(1, Math.min(20, parseInt(value) || 1));
            } else if (property === 'modifier') {
                group.modifier = parseInt(value) || 0;
            } else {
                group[property] = value;
            }
            this.updateRollButton();
        }
    }
    
    // Update roll button state
    updateRollButton() {
        const rollBtn = document.getElementById('rollAllDice');
        if (!rollBtn) return;
        
        const hasValidGroups = this.diceGroups.length > 0 && 
                              this.diceGroups.some(group => group.count > 0);
        
        rollBtn.disabled = !hasValidGroups;
    }
    
    // Roll all dice
    async rollAllDice() {
        if (this.diceGroups.length === 0) return;
        
        const user = this.authManager.getCurrentUser();
        const room = this.authManager.getCurrentRoom();
        
        if (!user || !room) {
            console.error('❌ Utente o stanza non disponibili per lancio dadi');
            return;
        }
        
        const rollBtn = document.getElementById('rollAllDice');
        if (rollBtn) {
            rollBtn.classList.add('loading');
            rollBtn.disabled = true;
        }
        
        try {
            const rollResult = {
                id: FirebaseHelper.generateUserId(),
                userId: user.id,
                userName: user.name,
                userAvatar: user.avatar,
                userRole: user.role,
                timestamp: FirebaseHelper.getTimestamp(),
                groups: [],
                total: 0
            };
            
            let grandTotal = 0;
            
            console.log('🎲 Lancio dadi per:', user.name);
            
            // Roll each group
            this.diceGroups.forEach(group => {
                const groupResult = {
                    type: group.type,
                    count: group.count,
                    color: group.color,
                    modifier: group.modifier,
                    rolls: [],
                    subtotal: 0
                };
                
                const sides = parseInt(group.type.substring(1));
                let groupTotal = 0;
                
                // Roll individual dice
                for (let i = 0; i < group.count; i++) {
                    const roll = Math.floor(Math.random() * sides) + 1;
                    groupResult.rolls.push(roll);
                    groupTotal += roll;
                }
                
                groupResult.subtotal = groupTotal + group.modifier;
                grandTotal += groupResult.subtotal;
                rollResult.groups.push(groupResult);
            });
            
            rollResult.total = grandTotal;
            
            console.log('🎲 Risultato lancio:', rollResult);
            
            // Save to Firebase
            await FirebaseHelper.pushData(`rooms/${room}/diceRolls`, rollResult);
            
            console.log('✅ Lancio dadi salvato');
            
        } catch (error) {
            console.error('❌ Errore lancio dadi:', error);
        } finally {
            if (rollBtn) {
                rollBtn.classList.remove('loading');
                rollBtn.disabled = false;
            }
        }
    }
    
    // Listen to dice results
    listenToResults() {
        const room = this.authManager.getCurrentRoom();
        if (!room) {
            console.error('❌ Nessuna stanza per ascoltare risultati dadi');
            return;
        }
        
        console.log('👂 Ascolto risultati dadi per stanza:', room);
        
        this.resultsListener = FirebaseHelper.listenToData(`rooms/${room}/diceRolls`, (snapshot) => {
            this.handleResultsUpdate(snapshot);
        });
    }
    
    // Handle results update
    handleResultsUpdate(snapshot) {
        try {
            const resultsData = snapshot.val();
            const resultsList = document.getElementById('diceResults');
            
            if (!resultsList) {
                console.error('❌ Container risultati dadi non trovato');
                return;
            }
            
            if (!resultsData) {
                resultsList.innerHTML = '<div class="no-results">Nessun lancio ancora...</div>';
                console.log('🎲 Nessun risultato dadi');
                return;
            }
            
            // Convert to array and sort by timestamp (newest first)
            const results = Object.values(resultsData).sort((a, b) => {
                const timeA = typeof a.timestamp === 'number' ? a.timestamp : 0;
                const timeB = typeof b.timestamp === 'number' ? b.timestamp : 0;
                return timeB - timeA;
            });
            
            // Keep only last 20 results
            const recentResults = results.slice(0, 20);
            
            console.log(`🎲 Aggiornamento risultati dadi: ${recentResults.length} risultati`);
            
            resultsList.innerHTML = '';
            recentResults.forEach(result => {
                const resultElement = this.createResultElement(result);
                resultsList.appendChild(resultElement);
            });
            
        } catch (error) {
            console.error('❌ Errore aggiornamento risultati dadi:', error);
        }
    }
    
    // Create result element
    createResultElement(result) {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'dice-result';
        resultDiv.style.borderLeftColor = result.groups[0]?.color || '#8b4513';
        
        const timestamp = typeof result.timestamp === 'number' ? 
                         new Date(result.timestamp).toLocaleTimeString('it-IT', { 
                             hour: '2-digit', 
                             minute: '2-digit' 
                         }) : '--:--';
        
        let groupsHtml = '';
        result.groups.forEach(group => {
            const rollsHtml = group.rolls.map(roll => {
                let classes = 'die-value';
                if (group.type === 'd20') {
                    if (roll === 20) classes += ' critical-success';
                    if (roll === 1) classes += ' critical-failure';
                }
                return `<span class="${classes}" style="background-color: ${group.color}; color: #fff;">${roll}</span>`;
            }).join('');
            
            const modifierText = group.modifier !== 0 ? 
                                (group.modifier > 0 ? ` +${group.modifier}` : ` ${group.modifier}`) : '';
            
            groupsHtml += `
                <div class="result-group">
                    <span style="color: ${group.color}; font-weight: 600;">${group.count}${group.type}${modifierText}:</span>
                    <div class="group-dice">${rollsHtml}</div>
                    <span style="color: #d4af37;">= ${group.subtotal}</span>
                </div>
            `;
        });
        
        resultDiv.innerHTML = `
            <div class="result-header">
                <div class="result-avatar" style="${result.userAvatar ? `background-image: url(${result.userAvatar})` : ''}">
                    ${!result.userAvatar ? (result.userRole === 'master' ? '👑' : '🎲') : ''}
                </div>
                <span class="result-user" style="${result.userRole === 'master' ? 'color: #d4af37;' : ''}">${result.userName}</span>
                ${result.userRole === 'master' ? '<span style="color: #d4af37; font-size: 0.8rem;">👑</span>' : ''}
                <span class="result-time">${timestamp}</span>
            </div>
            <div class="result-groups">
                ${groupsHtml}
            </div>
            <div class="result-total">Totale: ${result.total}</div>
        `;
        
        // Add pulse animation for new results
        resultDiv.classList.add('pulse');
        
        return resultDiv;
    }
    
    // Cleanup
    cleanup() {
        console.log('🧹 Pulizia sistema dadi...');
        if (this.resultsListener) {
            FirebaseHelper.stopListening(this.resultsListener);
            this.resultsListener = null;
        }
    }
}

export default DiceSystem;