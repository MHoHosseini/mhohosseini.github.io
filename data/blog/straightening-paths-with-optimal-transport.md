---
title: Straightening generative paths with optimal transport
date: 2026-06-20
tags: optimal transport, flow matching, generative models
description: How an optimal-transport coupling turns curved flow-matching trajectories into straight lines you can integrate in a handful of steps.
math: true
---

Flow matching trains a **velocity field** $v_\theta(x, t)$ to transport a simple
base distribution to data along a path. The trouble, in its naive form, is that
the paths can be *curved* — and curved paths are expensive to integrate and
high-variance to learn from. Optimal transport fixes this beautifully.

## The setup

Pick a base sample $x_0 \sim \mathcal{N}(0, I)$ and a data sample $x_1$, and
interpolate linearly:

$$ x_t = (1 - t)\,x_0 + t\,x_1, \qquad t \in [0, 1]. $$

The velocity along this straight interpolant is constant, $x_1 - x_0$, so the
flow-matching objective is just a regression:

$$ \mathcal{L} = \mathbb{E}_{t,\,x_0,\,x_1}\Big[\, \big\lVert v_\theta(x_t, t) - (x_1 - x_0) \big\rVert^2 \,\Big]. $$

## Where the coupling matters

Here's the subtlety: how do we *pair* $x_0$ with $x_1$? If we pair them
independently, different $(x_0, x_1)$ interpolants **cross**, and the marginal
velocity the network must learn becomes curved and high-variance.

Instead, draw the pair from an **optimal-transport coupling** $\pi_{\text{OT}}$.
Within a minibatch this is cheap — and in one dimension it's exact: just sort and
**rank-pair**. OT coupling minimizes the expected squared displacement, so on
average the straight interpolants *don't cross*:

$$ \pi_{\text{OT}} = \arg\min_{\pi}\ \mathbb{E}_{(x_0, x_1)\sim\pi}\ \lVert x_1 - x_0 \rVert^2. $$

The payoff is concrete. Straighter paths mean:

- **fewer integration steps** at inference — four Euler steps can be enough;
- **lower-variance targets** during training;
- and a cleaner link to the theory of **Wasserstein geodesics**.

## Inference under the right loss

One last trick I like. If your metric is mean absolute error, the optimal point
estimate is the **conditional median**, not the mean. So at inference I sample
$K$ noise seeds, integrate the ODE $\dot{x} = v_\theta(x, t)$ for each, and take
the per-coordinate median:

$$ \hat{x}_1 = \operatorname{median}_{k=1,\dots,K}\ \Phi_\theta(x_0^{(k)}), $$

where $\Phi_\theta$ is the learned flow map. It's a small thing, but it's the
statistically correct way to turn a generative model into a point predictor —
and it's exactly what made the difference in my
[Padova traffic project](/projects/padova-traffic-ot-flow/).

That's the whole idea: let optimal transport choose the geometry, and let the
loss choose the estimator.
