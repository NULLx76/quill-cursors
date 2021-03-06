import QuillCursors from './quill-cursors';
import Cursor from './cursor';
import 'jest-dom/extend-expect';

describe('QuillCursors', () => {
  let quill: any;

  beforeEach(() => {
    quill = {
      constructor: {
        events: {
          SELECTION_CHANGE: 'selection-change',
          TEXT_CHANGE: 'text-change',
        },
        sources: {
          API: 'api',
        },
      },
      addContainer: (className: string) => {
        quill.container = document.createElement('DIV');
        quill.container.classList.add(className);
        document.body.appendChild(quill.container);
        return quill.container;
      },
      container: null,
      emitter: {
        emit: () => {},
      },
      getBounds: () => {},
      getLeaf: () => {},
      getLength: () => 0,
      getSelection: () => {},
      on: () => {},
    };
  });

  describe('initialisation', () => {
    it('adds a container to Quill', () => {
      jest.spyOn(quill, 'addContainer');
      new QuillCursors(quill);
      expect(quill.addContainer).toHaveBeenCalledTimes(1);
    });

    it('registers a window resize listener', () => {
      jest.spyOn(window, 'addEventListener');
      const cursors = new QuillCursors(quill);
      expect(window.addEventListener).toHaveBeenCalledWith('resize', expect.anything());

      jest.spyOn(cursors, 'update');
      const resize = new Event('resize');
      window.dispatchEvent(resize);
      expect(cursors.update).toHaveBeenCalled();
    });
  });

  describe('text change listener', () => {
    let listeners: any;

    beforeEach(() => {
      listeners = {};

      jest.spyOn(quill, 'on').mockImplementation((event: string, callback: Function) => {
        listeners[event] = callback;
      });

      jest.spyOn(quill.emitter, 'emit');

      jest.spyOn(quill, 'getSelection').mockReturnValue({ index: 0, length: 0 });
    });

    it('registers the text change listener', () => {
      new QuillCursors(quill);
      expect(listeners['text-change']).toBeTruthy();
    });

    it('does not register the text change listener if setting the source to null', () => {
      new QuillCursors(quill, { selectionChangeSource: null });
      expect(listeners['text-change']).toBeFalsy();
    });

    it('emits the selection on text change', () => {
      jest.useFakeTimers();
      new QuillCursors(quill);

      jest.spyOn(quill, 'getSelection').mockReturnValue({ index: 10, length: 10 });
      listeners['text-change']();
      jest.runAllTimers();

      expect(quill.emitter.emit).toHaveBeenCalledTimes(1);
      expect(quill.emitter.emit).toHaveBeenCalledWith(
        'selection-change',
        { index: 10, length: 10 },
        { index: 0, length: 0 },
        'api'
      );
    });

    it('emits a custom source for selection-change on text change', () => {
      jest.useFakeTimers();
      new QuillCursors(quill, { selectionChangeSource: 'quill-cursors' });

      jest.spyOn(quill, 'getSelection').mockReturnValue({ index: 10, length: 10 });
      listeners['text-change']();
      jest.runAllTimers();

      expect(quill.emitter.emit).toHaveBeenCalledTimes(1);
      expect(quill.emitter.emit).toHaveBeenCalledWith(
        'selection-change',
        { index: 10, length: 10 },
        { index: 0, length: 0 },
        'quill-cursors'
      );
    });
  });

  describe('tracking current selection', () => {
    let listeners: any;

    beforeEach(() => {
      listeners = {};

      jest.spyOn(quill, 'on').mockImplementation((event: string, callback: Function) => {
        listeners[event] = callback;
      });

      jest.spyOn(quill.emitter, 'emit').mockImplementation((event: string, ...args: any[]) => {
        const callback = listeners[event];
        callback(...args);
      });

      jest.spyOn(quill, 'getSelection').mockReturnValue({ index: 0, length: 0 });
    });

    it('updates the current selection on text change', () => {
      jest.useFakeTimers();
      new QuillCursors(quill);

      jest.spyOn(quill, 'getSelection').mockReturnValue({ index: 10, length: 10 });
      quill.emitter.emit('text-change');
      jest.runAllTimers();

      expect(quill.emitter.emit).toHaveBeenCalledWith(
        'selection-change',
        { index: 10, length: 10 },
        { index: 0, length: 0 },
        'api'
      );

      jest.spyOn(quill, 'getSelection').mockReturnValue({ index: 20, length: 20 });
      quill.emitter.emit('text-change');
      jest.runAllTimers();

      expect(quill.emitter.emit).toHaveBeenCalledWith(
        'selection-change',
        { index: 20, length: 20 },
        { index: 10, length: 10 },
        'api'
      );
    });
  });

  describe('creating a cursor', () => {
    it('creates a cursor', () => {
      const cursors = new QuillCursors(quill);
      expect(cursors.cursors()).toHaveLength(0);

      cursors.createCursor('abc', 'Joe Bloggs', 'red');
      expect(cursors.cursors()).toHaveLength(1);
    });

    it('only creates a cursor with a given ID once', () => {
      const cursors = new QuillCursors(quill);
      expect(cursors.cursors()).toHaveLength(0);

      cursors.createCursor('abc', 'Joe Bloggs', 'red');
      cursors.createCursor('abc', 'Joe Bloggs', 'red');
      expect(cursors.cursors()).toHaveLength(1);
    });

    it('adds the cursor to the DOM', () => {
      const cursors = new QuillCursors(quill);
      expect(quill.container.childElementCount).toBe(0);

      cursors.createCursor('abc', 'Joe Bloggs', 'red');
      expect(quill.container.childElementCount).toBe(1);
    });

    it('can override the hide delay and speed', () => {
      const cursors = new QuillCursors(quill, {
        hideDelayMs: 1000,
        hideSpeedMs: 2000,
      });

      cursors.createCursor('abc', 'Jane Bloggs', 'red');

      const flag = quill.container.getElementsByClassName(Cursor.FLAG_CLASS)[0];
      expect(flag).toHaveStyle('transition-delay: 1000ms');
      expect(flag).toHaveStyle('transition-speed: 2000ms');
    });
  });

  describe('moving a cursor', () => {
    it('updates the cursor range', () => {
      const cursors = new QuillCursors(quill);
      const cursor = cursors.createCursor('abc', 'Jane Bloggs', 'red');
      expect(cursor.range).toBeFalsy();

      cursors.moveCursor('abc', { index: 0, length: 0 });
      expect(cursor.range).toEqual({ index: 0, length: 0 });
    });

    it('does not throw if the cursor does not exist', () => {
      const cursors = new QuillCursors(quill);
      expect(() => cursors.moveCursor('abc', null)).not.toThrow();
    });
  });

  describe('removing a cursor', () => {
    let cursors: QuillCursors;
    let cursor: Cursor;

    beforeEach(() => {
      cursors = new QuillCursors(quill);
      cursor = cursors.createCursor('abc', 'Joe Bloggs', 'red');
    });

    it('removes the cursor from the DOM', () => {
      expect(quill.container.childElementCount).toBe(1);
      expect(cursors.cursors()).toHaveLength(1);

      cursors.removeCursor(cursor.id);

      expect(quill.container.childElementCount).toBe(0);
      expect(cursors.cursors()).toHaveLength(0);
    });

    it('clears cursors', () => {
      expect(quill.container.childElementCount).toBe(1);
      expect(cursors.cursors()).toHaveLength(1);

      cursors.clearCursors();

      expect(quill.container.childElementCount).toBe(0);
      expect(cursors.cursors()).toHaveLength(0);
    });

    it('does not throw if the cursor does not exist', () => {
      expect(() => cursors.removeCursor('not-an-id')).not.toThrow();
    });
  });

  describe('updating cursors', () => {
    let cursors: QuillCursors;
    let cursor: Cursor;

    beforeEach(() => {
      cursors = new QuillCursors(quill);
      cursor = cursors.createCursor('abc', 'Joe Bloggs', 'red');

      jest.spyOn(quill, 'getBounds').mockReturnValue({
        top: 0,
        left: 0,
        width: 0,
        height: 0,
      });

      document.createRange = () => {
        const range: any = {
          setStart: () => {},
          setEnd: () => {},
          getClientRects: () => {
            const rectangles: any[] = [];
            return rectangles;
          },
          cloneRange: () => range,
        };

        return range;
      };
    });

    it('hides a cursor with no range', () => {
      jest.spyOn(cursor, 'hide');
      jest.spyOn(cursor, 'show');
      cursors.moveCursor(cursor.id, null);

      expect(cursor.hide).toHaveBeenCalled();
      expect(cursor.show).not.toHaveBeenCalled();
    });

    it('hides a cursor with no range if the range is updated manually', () => {
      jest.spyOn(cursor, 'hide');
      jest.spyOn(cursor, 'show');
      cursor.range = null;

      expect(cursor.hide).not.toHaveBeenCalled();
      cursors.update();

      expect(cursor.hide).toHaveBeenCalled();
      expect(cursor.show).not.toHaveBeenCalled();
    });

    it('hides a cursor with a range, but no valid leaf', () => {
      jest.spyOn(cursor, 'hide');
      jest.spyOn(cursor, 'show');
      jest.spyOn(quill, 'getLeaf').mockReturnValue(null);
      cursors.moveCursor(cursor.id, { index: 0, length: 0 });

      expect(cursor.hide).toHaveBeenCalled();
      expect(cursor.show).not.toHaveBeenCalled();
    });

    it('shows a cursors with a valid range and leaf', () => {
      jest.spyOn(cursor, 'hide');
      jest.spyOn(cursor, 'show');
      jest.spyOn(quill, 'getLeaf').mockReturnValue([
        { domNode: document.createElement('DIV') },
        0,
      ]);
      cursors.moveCursor(cursor.id, { index: 0, length: 0 });

      expect(cursor.hide).not.toHaveBeenCalled();
      expect(cursor.show).toHaveBeenCalled();
    });

    it('forces ranges into the Quill bounds', () => {
      jest.spyOn(quill, 'getLength').mockReturnValue(10);
      jest.spyOn(quill, 'getLeaf');

      cursors.moveCursor(cursor.id, { index: -10, length: 100 });

      expect(quill.getLeaf).toHaveBeenCalledWith(0);
      expect(quill.getLeaf).toHaveBeenCalledWith(10);
    });
  });
});
