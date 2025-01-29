class SelectionManager {
    constructor(board, svgContainer, onSelectionUpdate) {
        this.board = board;

        // Limpiar cualquier SVG existente
        this.board.querySelectorAll('svg').forEach(svg => svg.remove());

        // Crear nuestro propio SVG container
        this.svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svgContainer.id = 'lines';
        this.board.insertBefore(this.svgContainer, this.board.firstChild);

        this.onSelectionUpdate = onSelectionUpdate;

        this.selected = [];

        // Inicializar las propiedades privadas
        this._isPointerDown = false;
        this._isDragging = false;
        this.potentialUndo = null;
        this.startedInsideBoard = false;
        this._lastTouchMove = null;
        this._lastTouchEvent = null;
        this._wasSelecting = false;
    }

    reset() {
        this.selected.forEach(pos =>
            document.getElementById(`mark-${pos}`).classList.remove('selected')
        );
        this.svgContainer.innerHTML = '';
        this.selected = [];
        this.potentialUndo = null;
    }

    resetControls() {
        [this._isPointerDown, this._isDragging, this.potentialUndo, this.startedInsideBoard] =
            [false, false, null, false];
    }

    getCurrentSelection() {
        return [...this.selected];
    }

    drawLine() {
        this.svgContainer.innerHTML = '';
        this.selected.forEach((pos, i) => {
            if (i === 0) return;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            const [cA, cB] = [this.selected[i - 1], pos].map(p =>
                document.getElementById(`mark-${p}`).getBoundingClientRect()
            );
            const boardRect = this.board.getBoundingClientRect();

            ['x1', 'y1', 'x2', 'y2'].forEach((attr, i) => {
                const rect = i < 2 ? cA : cB;
                line.setAttribute(attr,
                    rect[attr.startsWith('x') ? 'x' : 'y'] +
                    rect.width / 2 -
                    boardRect[attr.startsWith('x') ? 'x' : 'y']
                );
            });

            this.svgContainer.appendChild(line);
        });
    }

    handleLetterSelection(num) {
        const len = this.selected.length;

        if (this.selected.includes(num)) {
            if (num === this.selected[len - 1]) {
                this.potentialUndo = num;
                this.onSelectionUpdate(this.selected);
                return true;
            }
            if (num === this.selected[len - 2]) {
                document.getElementById(`mark-${this.selected[len - 1]}`).classList.remove('selected');
                this.selected.pop();
                this.drawLine();
                this.onSelectionUpdate(this.selected);
                return true;
            }
            return false;
        }

        this.potentialUndo = null;
        if (!len || this.areAdjacent(this.selected[len - 1], num)) {
            const mark = document.getElementById(`mark-${num}`);
            this.selected.push(num);
            mark.classList.add('selected');
            this.drawLine();
            this.onSelectionUpdate(this.selected);
            return true;
        }

        if (!this.isDragging) {
            this.reset();
            document.getElementById(`mark-${num}`).classList.add('selected');
            this.selected.push(num);
            this.onSelectionUpdate(this.selected);
            return true;
        }

        return false;
    }

    areAdjacent(posA, posB) {
        if (posA === posB) return false;
        const [rowA, colA] = [posA.charCodeAt(0) - 97, parseInt(posA[1]) - 1];
        const [rowB, colB] = [posB.charCodeAt(0) - 97, parseInt(posB[1]) - 1];
        return Math.abs(rowA - rowB) <= 1 && Math.abs(colA - colB) <= 1;
    }

    handlePointerDown(e) {
        const isInsideBoard = !!e?.target?.closest('.board');
        this.startedInsideBoard = isInsideBoard;

        if (!isInsideBoard) return;

        const hitbox = this.getHitboxFromEvent(e);
        if (!hitbox) {
            if (!this.isDragging) this.reset();
            return;
        }

        e.preventDefault();
        this._isPointerDown = true;
        this._isDragging = false;
        this.handleLetterSelection(hitbox.dataset.position);
    }

    handlePointerMove(e) {
        if (!this._isPointerDown || !e.target?.closest('.board')) return;
        e.preventDefault();

        if (!this.startedInsideBoard && !this._isDragging) return;

        const currentHitbox = this.getHitboxFromEvent(e);
        if (!currentHitbox) return;

        const currentPos = currentHitbox.dataset.position;
        if (this.selected[this.selected.length - 1] === currentPos) return;

        this._isDragging = true;
        this.handleLetterSelection(currentPos);
    }

    handlePointerUp(e) {  // Eliminado el parámetro resetAll
        if (!this._isDragging && this.potentialUndo) {
            const hitbox = this.getHitboxFromEvent(e);
            if (hitbox && this.potentialUndo === hitbox.dataset.position) {
                document.getElementById(`mark-${this.potentialUndo}`).classList.remove('selected');
                this.selected.pop();
                this.drawLine();
            }
        }

        if (!e?.target?.closest('.board')) {
            this.resetControls();
            this.reset();
        } else {
            this._isPointerDown = false;
            this._isDragging = false;
        }
    }

    handlePointerOut() {
        this._isPointerDown = false;
        return this._isDragging || this.selected.length > 0;
    }

    handlePointerEnter(e) {
        if (e.buttons > 0 && (this.startedInsideBoard || this.selected.length > 0)) {
            this._isPointerDown = true;
        }
    }

    getHitboxFromEvent(e) {
        if (!e) return null;

        if (e.touches || e.changedTouches) {
            const touch = e.touches?.[0] || e.changedTouches?.[0];
            if (!touch) return null;

            const element = document.elementFromPoint(touch.clientX, touch.clientY);
            return element?.closest('.hitbox');
        }

        return e.target?.closest('.hitbox');
    }

    isPlayableArea(e) {
        if (!e?.target) return false;
        return e.target.closest('.hitbox') || e.target.closest('.board');
    }

    get isDragging() {
        return this._isDragging;
    }

    get isPointerDown() {
        return this._isPointerDown;
    }

    handleTouchMove(e) {
        e.preventDefault();
        this.handlePointerMove(e);
    }

    getWasSelecting() {
        return this._wasSelecting;
    }

    setWasSelecting(value) {
        this._wasSelecting = value;
    }
}

export { SelectionManager as S };
