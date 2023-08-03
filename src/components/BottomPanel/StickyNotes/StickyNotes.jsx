import { dispatchCustomEvent } from "utils";
import { useNotes } from "contexts/stickyNotes";
import Icon from "components/Icon";
import Dropdown from "components/Dropdown";
import "./sticky-notes.css";

export default function StickyNotes({ hide }) {
  const { notes, removeNote } = useNotes();

  function createNote(event) {
    const x = event.clientX / document.documentElement.clientWidth * 100;
    const y = event.clientY / document.documentElement.clientHeight * 100;

    dispatchCustomEvent("sticky-note", { action: "create", x, y });
    hide();
  }

  function editNote(id) {
    dispatchCustomEvent("sticky-note", { action: "edit", id });
    hide();
  }

  return (
    <div className="sticky-notes-list-container">
      {notes.length ? (
        <ul className="sticky-notes-list" data-dropdown-parent>
          {notes.toReversed().map(note => (
            <li className="sticky-notes-list-item" style={{ backgroundColor: note.color }} key={note.id}>
              <div>
                {note.title ? <p className="sticky-notes-list-item-title">{note.title}</p> : null}
                {note.content ? <p className="sticky-notes-list-item-content">{note.content}</p> : null}
              </div>
              <Dropdown>
                <button className="btn icon-text-btn dropdown-btn" onClick={() => editNote(note.id)}>
                  <Icon id="edit"/>
                  <span>Edit</span>
                </button>
                <button className="btn icon-text-btn dropdown-btn" onClick={() => removeNote(note.id)}>
                  <Icon id="trash"/>
                  <span>Remove</span>
                </button>
              </Dropdown>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sticky-notes-list-message">No notes</p>
      )}
      <button className="btn icon-text-btn create-btn" onClick={createNote}>
        <Icon id="plus"/>
        <span>Create</span>
      </button>
    </div>
  );
}
