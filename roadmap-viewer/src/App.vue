<script setup lang="ts">
import roadmapData from "../../docs/roadmap-data.json";
import {
  createRoadmapViewModel,
  getPhaseStatusLabel,
  type PhaseStatus,
  type RoadmapData,
} from "./roadmap";

const model = createRoadmapViewModel(roadmapData as RoadmapData);

function phaseClass(status: PhaseStatus): string {
  return `phase phase-${status}`;
}
</script>

<template>
  <main class="page">
    <header class="hero">
      <div>
        <p class="eyebrow">平安批 / 开发管理</p>
        <h1>{{ model.data.title }}</h1>
        <p class="summary">{{ model.data.summary }}</p>
      </div>
      <div class="hero-meta">
        <span>更新：{{ model.data.updatedAt }}</span>
        <span>{{ model.completedCount }} / {{ model.totalCount }} 完成</span>
        <span>{{ model.completionPercent }}%</span>
      </div>
    </header>

    <div class="bento-container">
      <aside class="bento-sidebar">
        <section class="panel phase-panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">阶段进度</p>
              <h2>Roadmap</h2>
            </div>
          </div>
          <div class="phase-groups-wrapper">
            <div class="phase-groups">
              <section
                v-for="group in model.phaseGroups"
                :key="group.status"
                class="phase-group"
              >
                <h3>{{ group.label }}</h3>
                <div class="phase-list">
                  <article
                    v-for="phase in group.phases"
                    :key="phase.id"
                    :class="phaseClass(phase.status)"
                  >
                    <div class="phase-number">{{ phase.id }}</div>
                    <div>
                      <div class="phase-title">
                        <span>{{ phase.title }}</span>
                        <em>{{ getPhaseStatusLabel(phase.status) }}</em>
                      </div>
                    </div>
                  </article>
                </div>
              </section>
            </div>
          </div>
        </section>
      </aside>

      <div class="bento-main">
        <section class="metrics" aria-label="关键状态">
          <article
            v-for="metric in model.data.metrics"
            :key="metric.label"
            class="metric"
          >
            <p>{{ metric.label }}</p>
            <strong>{{ metric.value }}</strong>
            <span>{{ metric.note }}</span>
          </article>
        </section>

        <section class="focus-grid">
          <article class="panel">
            <p class="eyebrow">当前基线</p>
            <h2>{{ model.currentPhase?.title }}</h2>
            <p>{{ model.currentPhase?.summary }}</p>
          </article>
          <article class="panel panel-accent">
            <p class="eyebrow">下一步</p>
            <h2>{{ model.nextPhase?.title }}</h2>
            <p>{{ model.nextPhase?.summary }}</p>
          </article>
        </section>

        <section class="bottom-grid">
          <article class="panel">
            <div class="section-head">
              <div>
                <p class="eyebrow">风险</p>
                <h2>{{ model.riskCount }} 项待关注</h2>
              </div>
            </div>
            <ul class="risk-list">
              <li v-for="risk in model.data.risks" :key="risk">{{ risk }}</li>
            </ul>
          </article>

          <article class="panel">
            <p class="eyebrow">文档</p>
            <h2>快速入口</h2>
            <div class="link-list">
              <a
                v-for="link in model.data.links"
                :key="link.href"
                :href="link.href"
                >{{ link.label }}</a
              >
            </div>
          </article>
        </section>
      </div>
    </div>
  </main>
</template>
