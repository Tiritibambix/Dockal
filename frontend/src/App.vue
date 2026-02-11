<template>
  <div id="app" class="bg-white min-h-screen">
    <header class="bg-blue-600 text-white p-4">
      <h1 class="text-2xl font-bold">Dockal — Calendar</h1>
    </header>
    <main class="p-4">
      <FullCalendar :options='calendarOptions'/>
    </main>
  </div>
</template>

<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { ref } from 'vue'

const calendarOptions = ref({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay'
  },
  editable: true,
  selectable: true,
  selectMirror: true,
  dayMaxEvents: true,
  weekends: true,
  select: handleDateSelect,
  eventClick: handleEventClick,
  eventsSet: handleEvents
})

function handleDateSelect(selectInfo) {
  // Handle date selection
}

function handleEventClick(clickInfo) {
  // Handle event click
}

function handleEvents(events) {
  // Handle events
}
</script>

<style scoped>
/* ...existing code... */
</style>