---
layout: page
permalink: /teaching/
title: teaching
description: Materials for courses you taught. Replace this text with your description.
nav: true
nav_order: 5
display_categories: [Computer Science, Machine Learning]
horizontal: false
---
<!-- pages/teaching.md -->
<div class="teachings">
{%- if site.enable_teaching_categories and page.display_categories %}
  <!-- Display categorized teaching -->
  {%- for category in page.display_categories %}
  <h2 class="category">{{ category }}</h2>
  {%- assign categorized_teaching = site.teaching | where: "category", category -%}
  {%- assign sorted_teaching = categorized_teaching | sort: "importance" %}
  <!-- Generate cards for each teaching -->
  {% if page.horizontal -%}
  <div class="container">
    <div class="row row-cols-2">
    {%- for teaching in sorted_teaching -%}
      {% include teaching_horizontal.html %}
    {%- endfor %}
    </div>
  </div>
  {%- else -%}
  <div class="grid">
    {%- for teaching in sorted_teaching -%}
      {% include teaching.html %}
    {%- endfor %}
  </div>
  {%- endif -%}
  {% endfor %}

{%- else -%}
<!-- Display teaching without categories -->
  {%- assign sorted_teaching = site.teaching | sort: "importance" -%}
  <!-- Generate cards for each teaching -->
  {% if page.horizontal -%}
  <div class="container">
    <div class="row row-cols-2">
    {%- for teaching in sorted_teaching -%}
      {% include teaching_horizontal.html %}
    {%- endfor %}
    </div>
  </div>
  {%- else -%}
  <div class="grid">
    {%- for teaching in sorted_teaching -%}
      {% include teaching.html %}
    {%- endfor %}
  </div>
  {%- endif -%}
{%- endif -%}
</div>