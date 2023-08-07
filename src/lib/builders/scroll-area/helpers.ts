import { get, writable } from 'svelte/store';

type Machine<S> = { [k: string]: { [k: string]: S } };
type MachineState<T> = keyof T;
type MachineEvent<T> = keyof UnionToIntersection<T[keyof T]>;
// 🤯 https://fettblog.eu/typescript-union-to-intersection/
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (x: infer R) => any
	? R
	: never;

export function stateMachine<M>(
	initialState: MachineState<M>,
	machine: M & Machine<MachineState<M>>
) {
	const { subscribe, set } = writable(initialState);

	const state = {
		subscribe,
		transition,
	};

	function transition(event: MachineEvent<M>) {
		const nextState = (machine[get(state)] as any)[event];
		if (nextState) {
			set(nextState);
		}
	}

	return state;
}
