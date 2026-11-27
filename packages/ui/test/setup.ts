import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom has no modal <dialog>: these only toggle `open`; the browser checks prove the modal itself.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute('open', '')
}
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.removeAttribute('open')
}

afterEach(cleanup)
