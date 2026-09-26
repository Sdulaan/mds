'use client';

import { startTransition, useActionState, useRef, type FormEvent } from 'react';
import type { ActionResult } from '@/types';

type FormActionFn = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

const initialState: ActionResult = { success: false, message: '' };

/**
 * Like useActionState, but the form keeps its values when the action fails and
 * is only cleared on success. (Passing an action to <form action> makes React
 * reset the form after every submission, including failed ones.)
 */
export function useFormAction(action: FormActionFn) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, dispatch, pending] = useActionState<ActionResult, FormData>(async (prev, formData) => {
    const result = await action(prev, formData);
    if (result.success) formRef.current?.reset();
    return result;
  }, initialState);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  };

  return { state, pending, formRef, onSubmit };
}
