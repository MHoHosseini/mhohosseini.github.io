---
title: Turning toward pure mathematics
date: 2026-07-05
tags: research, pure mathematics, generative models
description: A short note on why I'm reorienting my work around pure mathematics — and why generative models are where that mathematics comes alive.
math: false
---

I've spent the last few years building things: diffusion models, flows, graph
networks, inference machinery. I loved it. But if I'm honest about what actually
pulls me forward, it isn't the engineering — it's the **mathematics underneath**.

So I'm making the turn explicit. My centre of gravity now is pure mathematics,
and I'm treating generative modeling and deep learning as the place where that
mathematics becomes concrete and testable.

## Why now

Three questions kept recurring in my work, and none of them are really about
neural networks:

- When a diffusion model generates, it integrates a **reverse-time stochastic
  differential equation**. What geometry lives on those paths?
- When a flow transports noise to data, it's solving a transport problem. What
  does **optimal transport** tell us about the *right* way to do that?
- When a Neural ODE deforms a latent space, it's acting as a homeomorphism.
  Which **topological and differential-geometric invariants** does it preserve?

Each of these is a mathematics question wearing a machine-learning costume.

> I don't want to use the mathematics as after-the-fact justification. I want it
> to be the source of the next idea.

## Where I'm heading

Over the next few months I'm focusing my PhD applications on **pure mathematics
and generative models**. The directions I most want to work in:

1. **Optimal transport** — the geometry of moving one distribution onto another.
2. **Differential geometry** — curvature, manifolds, and the shape of latent space.
3. **Functional analysis** — the spaces where scores, densities, and velocity
   fields actually live.

And the thread tying them together: the likely connections between **stochastic
differential equations, geometry, and analysis**.

This blog is where I'll think out loud about all of it — sometimes a clean
derivation, sometimes a half-formed intuition. If any of it resonates,
[reach out](mailto:m.ho.hosseini@gmail.com).
